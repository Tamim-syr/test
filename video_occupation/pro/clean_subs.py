# Efface les sous-titres incrustés (texte blanc à contour noir, bas de l'image) par retouche image par image
import cv2, numpy as np, subprocess
W, H = 1280, 720
dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", "face_graded.mov", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", "30", "-i", "-",
                        "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-pix_fmt", "yuv420p", "face_clean.mp4"], stdin=subprocess.PIPE)
y0 = int(H * .78); n = 0
while True:
    buf = dec.stdout.read(W * H * 3)
    if len(buf) < W * H * 3: break
    im = np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()
    band = im[y0:]; white = (band.min(2) > 175).astype(np.uint8)
    if white.sum() > 40:
        m = cv2.dilate(cv2.morphologyEx(white, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)), np.ones((9, 9), np.uint8))
        mask = np.zeros((H, W), np.uint8); mask[y0:] = m * 255
        im = cv2.inpaint(im, mask, 6, cv2.INPAINT_TELEA)
    enc.stdin.write(im.tobytes()); n += 1
enc.stdin.close(); enc.wait(); print("frames", n)
