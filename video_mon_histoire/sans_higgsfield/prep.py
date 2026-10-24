# Passe les dessins SD-Turbo en « carte à gratter » blanc sur noir, 1152x2048
import sys, numpy as np, cv2
def scratch(src, dst):
    im = cv2.imread(src, 0).astype(np.float32)
    h, w = im.shape
    border = np.concatenate([im[:20].ravel(), im[-20:].ravel(), im[:, :20].ravel(), im[:, -20:].ravel()])
    if np.median(border) > 110 or im.mean() > 120: im = 255 - im          # dessin noir sur clair -> inverser
    W, H = 1152, 2048; s = max(W / w, H / h)
    im = cv2.resize(im, (int(w * s + .5), int(h * s + .5)), interpolation=cv2.INTER_LANCZOS4)
    y0, x0 = (im.shape[0] - H) // 2, (im.shape[1] - W) // 2; im = im[y0:y0 + H, x0:x0 + W]
    blur = cv2.GaussianBlur(im, (0, 0), 2.2); im = cv2.addWeighted(im, 1.8, blur, -0.8, 0)     # netteté du trait
    im = np.clip((im - 38) / 190, 0, 1) ** 1.25 * 255                                           # noirs profonds, traits blancs
    cv2.imwrite(dst, im.astype(np.uint8))
if __name__ == "__main__":
    for a, b in zip(sys.argv[1::2], sys.argv[2::2]): scratch(a, b)
