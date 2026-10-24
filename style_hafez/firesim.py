# Feu réaliste par simulation de fluide (Taichi, Apache-2.0) : vitesse, chaleur, fumée, poussée, tourbillons.
# Le feu naît sur la zone détectée dans le dessin, puis il est rendu en blanc sur noir avec des contours au trait.
import numpy as np, cv2, taichi as ti
ti.init(arch=ti.cpu, default_fp=ti.f32, random_seed=3)

@ti.data_oriented
class Fire:
    def __init__(self, emit_mask, nx=216, ny=384, buoy=5.0, cool=0.965, conf=9.0, wind=0.0):
        self.nx, self.ny = nx, ny
        self.vel = ti.Vector.field(2, ti.f32, (nx, ny)); self.vel2 = ti.Vector.field(2, ti.f32, (nx, ny))
        self.T = ti.field(ti.f32, (nx, ny)); self.T2 = ti.field(ti.f32, (nx, ny))
        self.S = ti.field(ti.f32, (nx, ny)); self.S2 = ti.field(ti.f32, (nx, ny))
        self.p = ti.field(ti.f32, (nx, ny)); self.p2 = ti.field(ti.f32, (nx, ny))
        self.div = ti.field(ti.f32, (nx, ny)); self.curl = ti.field(ti.f32, (nx, ny))
        self.src = ti.field(ti.f32, (nx, ny))
        # masque d'émission : image (H, W) -> grille (nx, ny) avec y vers le haut
        m = cv2.resize(emit_mask.astype(np.float32), (nx, ny), interpolation=cv2.INTER_AREA)[::-1].T.copy()
        self.src.from_numpy(m)
        self.buoy, self.cool, self.conf, self.wind = buoy, cool, conf, wind

    @ti.func
    def sample(self, f: ti.template(), x, y):
        x = ti.max(0.0, ti.min(self.nx - 1.001, x)); y = ti.max(0.0, ti.min(self.ny - 1.001, y))
        i, j = int(x), int(y); fx, fy = x - i, y - j
        return (f[i, j] * (1 - fx) + f[i + 1, j] * fx) * (1 - fy) + (f[i, j + 1] * (1 - fx) + f[i + 1, j + 1] * fx) * fy

    @ti.kernel
    def advect(self, dt: ti.f32):
        for i, j in self.vel:
            v = self.vel[i, j]
            x, y = i - v.x * dt, j - v.y * dt
            self.vel2[i, j] = self.sample(self.vel, x, y) * 0.995
            self.T2[i, j] = self.sample(self.T, x, y) * self.cool
            self.S2[i, j] = self.sample(self.S, x, y) * 0.985

    @ti.kernel
    def forces(self, dt: ti.f32, t: ti.f32):
        for i, j in self.vel:
            self.vel[i, j] = self.vel2[i, j]; self.T[i, j] = self.T2[i, j]; self.S[i, j] = self.S2[i, j]
            s = self.src[i, j]
            if s > 0.05:   # foyer qui scintille : chaleur et poussée irrégulières
                n = ti.random() * 0.9 + 0.4 * ti.sin(t * 7.0 + i * 0.35)
                self.T[i, j] = ti.max(self.T[i, j], s * ti.max(0.0, n))
                self.vel[i, j].y += s * (25.0 + 20.0 * ti.random()) * dt
                self.vel[i, j].x += (ti.random() - 0.5) * 60.0 * dt * s
            self.vel[i, j].y += (self.buoy * self.T[i, j] * 60.0 - 4.0 * self.S[i, j]) * dt
            self.vel[i, j].x += self.wind * self.T[i, j] * dt * 60.0
            self.S[i, j] += 0.04 * self.T[i, j]
        for i, j in self.curl:
            if 0 < i < self.nx - 1 and 0 < j < self.ny - 1:
                self.curl[i, j] = 0.5 * ((self.vel[i + 1, j].y - self.vel[i - 1, j].y) - (self.vel[i, j + 1].x - self.vel[i, j - 1].x))
        for i, j in self.vel:   # confinement de vorticité : garde les volutes du feu
            if 1 < i < self.nx - 2 and 1 < j < self.ny - 2:
                gx = 0.5 * (ti.abs(self.curl[i + 1, j]) - ti.abs(self.curl[i - 1, j]))
                gy = 0.5 * (ti.abs(self.curl[i, j + 1]) - ti.abs(self.curl[i, j - 1]))
                l = ti.sqrt(gx * gx + gy * gy) + 1e-5
                w = self.curl[i, j]
                self.vel[i, j] += self.conf * dt * ti.Vector([gy / l * w, -gx / l * w])

    @ti.kernel
    def divergence(self):
        for i, j in self.div:
            l = self.vel[ti.max(i - 1, 0), j].x; r = self.vel[ti.min(i + 1, self.nx - 1), j].x
            b = self.vel[i, ti.max(j - 1, 0)].y; t = self.vel[i, ti.min(j + 1, self.ny - 1)].y
            self.div[i, j] = 0.5 * (r - l + t - b)

    @ti.kernel
    def jacobi(self):
        for i, j in self.p:
            l = self.p[ti.max(i - 1, 0), j]; r = self.p[ti.min(i + 1, self.nx - 1), j]
            b = self.p[i, ti.max(j - 1, 0)]; t = self.p[i, ti.min(j + 1, self.ny - 1)]
            self.p2[i, j] = (l + r + b + t - self.div[i, j]) * 0.25

    @ti.kernel
    def copyp(self):
        for i, j in self.p:
            self.p[i, j] = self.p2[i, j]

    @ti.kernel
    def project(self):
        for i, j in self.vel:
            l = self.p[ti.max(i - 1, 0), j]; r = self.p[ti.min(i + 1, self.nx - 1), j]
            b = self.p[i, ti.max(j - 1, 0)]; t = self.p[i, ti.min(j + 1, self.ny - 1)]
            self.vel[i, j] -= 0.5 * ti.Vector([r - l, t - b])

    def step(self, dt, t):
        self.advect(dt); self.forces(dt, t); self.divergence()
        for _ in range(30):
            self.jacobi(); self.copyp()
        self.project()

    def image(self, W=1080, H=1920):
        T = self.T.to_numpy().T[::-1]; S = self.S.to_numpy().T[::-1]
        T = cv2.resize(T, (W, H), interpolation=cv2.INTER_CUBIC); S = cv2.resize(S, (W, H), interpolation=cv2.INTER_CUBIC)
        return np.clip(T, 0, 1.5), np.clip(S, 0, 1)

def stylize(T, S):
    """Rendu « dessin » : flamme lumineuse blanche + contours tracés aux niveaux de chaleur + fumée hachurée."""
    glow = np.clip(T * 1.6, 0, 1) ** 1.2 * 255
    out = glow.copy()
    Ts = cv2.GaussianBlur(T.astype(np.float32), (0, 0), 4)
    for lv, w in ((0.22, 3), (0.55, 2)):
        b = (Ts > lv).astype(np.uint8)
        edge = cv2.morphologyEx(b, cv2.MORPH_GRADIENT, np.ones((w + 1, w + 1), np.uint8))
        out = np.maximum(out, edge * 255.0)
    h, w = T.shape; yy, xx = np.mgrid[0:h, 0:w]
    hatch = (((xx + yy) % 10) < 2).astype(np.float32)
    smoke = np.clip(S - 0.15, 0, 1) * hatch * 160
    return np.maximum(out, smoke)
