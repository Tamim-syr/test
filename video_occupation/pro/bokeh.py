# Arrière-plan flou façon objectif grande ouverture : détourage MODNet (ONNX) + flou progressif + légère baisse du fond
import cv2, numpy as np, subprocess, sys, onnxruntime as ort, glob
M = glob.glob("/root/.cache/huggingface/hub/models--Xenova--modnet/snapshots/*/onnx/model.onnx")[0]
so = ort.SessionOptions(); so.intra_op_num_threads = 2
sess = ort.InferenceSession(M, so); iname = sess.get_inputs()[0].name
W, H = 1280, 720; IW, IH = 512, 288
def matte(img):
    x = cv2.resize(img, (IW, IH))[:, :, ::-1].astype(np.float32) / 127.5 - 1
    m = sess.run(None, {iname: x.transpose(2, 0, 1)[None]})[0][0, 0]
    return cv2.resize(m, (W, H), interpolation=cv2.INTER_LINEAR)
src, dst = sys.argv[1], sys.argv[2]; limit = int(sys.argv[3]) if len(sys.argv) > 3 else 10**9
dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", src, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", "30", "-i", "-",
                        "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-pix_fmt", "yuv420p", dst], stdin=subprocess.PIPE)
prev = None; n = 0
while n < limit:
    buf = dec.stdout.read(W * H * 3)
    if len(buf) < W * H * 3: break
    im = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
    a = matte(im)
    a = a if prev is None else prev * .45 + a * .55                    # lissage temporel du détourage
    prev = a
    a3 = cv2.GaussianBlur(np.clip((a - .08) / .84, 0, 1), (0, 0), 2.2)[..., None]
    f = im.astype(np.float32)
    bg = cv2.GaussianBlur(f, (0, 0), 9) * .62 + cv2.GaussianBlur(f, (0, 0), 20) * .38   # flou doux à deux échelles
    bg *= .82                                                           # fond un peu plus sombre : le sujet ressort
    out = f * a3 + bg * (1 - a3)
    enc.stdin.write(np.clip(out, 0, 255).astype(np.uint8).tobytes()); n += 1
enc.stdin.close(); enc.wait(); print("frames", n)
