/* Dynamic Interactive Labs — Math: where the formulas of the engineering labs come from. Each note derives the formulas a lab
   uses, step by step, typeset with KaTeX (MB.Tex). Opened from the Math page or from a "Math" link next to a formula:
   MB.suite.go('eng-math', { topic: id, from: { lab, scene, label } }). */
(function (G) {
  'use strict';
  const MB = G.MB;
  const N = (MB.MathNotes = { list: [] });
  const add = (o) => N.list.push(o);

  add({ id: 'area-moments', title: 'Area integrals: centroid, second moments, Steiner', area: 'Integrals over plane regions',
    used: [['Section properties', 'som', 'section'], ['Bending stress', 'som', 'bending'], ['Beam: side view and sections', 'som', 'beam']],
    body: String.raw`
<p>A cross-section is a plane region $A$ with coordinates $y$ (to the right) and $z$ (downwards). Everything the strength of materials needs from its shape is a handful of integrals over that region.</p>
<h3>First moments and the centroid</h3>
$$A = \int_A \mathrm dA, \qquad S_y = \int_A z\,\mathrm dA, \qquad S_z = \int_A y\,\mathrm dA$$
<p>The centroid $S$ is the point about which both first moments vanish:</p>
$$y_S = \frac{S_z}{A} = \frac{1}{A}\int_A y\,\mathrm dA, \qquad z_S = \frac{S_y}{A} = \frac{1}{A}\int_A z\,\mathrm dA$$
<p>Integrals are additive over parts that do not overlap. For a section built from simple parts with areas $A_i$ and centroids $(y_i, z_i)$ the integral becomes a sum; a hole is a part with negative area:</p>
$$y_S = \frac{\sum_i A_i\,y_i}{\sum_i A_i}, \qquad z_S = \frac{\sum_i A_i\,z_i}{\sum_i A_i}$$
<h3>Second moments</h3>
<p>Measured from the centroid:</p>
$$I_y = \int_A z^2\,\mathrm dA, \qquad I_z = \int_A y^2\,\mathrm dA, \qquad I_{yz} = -\int_A y\,z\,\mathrm dA, \qquad I_p = \int_A r^2\,\mathrm dA = I_y + I_z$$
<p>The minus sign in $I_{yz}$ is a convention that makes the three numbers transform like the components of a stress tensor when the axes turn (see <i>Turning the axes</i>).</p>
<h3>Worked integral: the rectangle</h3>
<p>Width $b$, height $h$, centroid at the origin. The integrand depends on $z$ only, so the $y$-integral just gives $b$:</p>
$$I_y = \int_{-h/2}^{h/2}\!\int_{-b/2}^{b/2} z^2\,\mathrm dy\,\mathrm dz = b\left[\frac{z^3}{3}\right]_{-h/2}^{h/2} = b\,\frac{1}{3}\left(\frac{h^3}{8} + \frac{h^3}{8}\right) = \frac{b\,h^3}{12}$$
<h3>Worked integral: the circle, in polar coordinates</h3>
<p>With $\mathrm dA = r\,\mathrm dr\,\mathrm d\varphi$:</p>
$$I_p = \int_0^{2\pi}\!\!\int_0^R r^2\,r\,\mathrm dr\,\mathrm d\varphi = 2\pi\,\frac{R^4}{4} = \frac{\pi R^4}{2}, \qquad I_y = I_z = \frac{I_p}{2} = \frac{\pi R^4}{4}$$
<p>(by symmetry $I_y = I_z$, and they add up to $I_p$).</p>
<h3>Parallel axes: Steiner’s theorem</h3>
<p>Take an axis $\bar y$ parallel to $y$ at a distance $a$, so that every point has $\bar z = z + a$. Expand the square under the integral:</p>
$$I_{\bar y} = \int_A (z + a)^2\,\mathrm dA = \underbrace{\int_A z^2\,\mathrm dA}_{I_y} + 2a\underbrace{\int_A z\,\mathrm dA}_{S_y \,=\, 0} + a^2\underbrace{\int_A \mathrm dA}_{A}$$
<p>The middle term vanishes because $y$ passes through the centroid. Hence</p>
$$I_{\bar y} = I_y + a^2 A, \qquad I_{\bar y\bar z} = -\int_A (y + a_y)(z + a_z)\,\mathrm dA = I_{yz} - a_y\,a_z\,A$$
<p>For a composite section every part contributes its own centroidal value plus its Steiner term, measured from the common centroid:</p>
$$I_y = \sum_i \left(I_{y,i} + \bar z_i^{\,2} A_i\right), \qquad I_z = \sum_i \left(I_{z,i} + \bar y_i^{\,2} A_i\right), \qquad I_{yz} = \sum_i \left(I_{yz,i} - \bar y_i \bar z_i A_i\right)$$
<p>This is exactly the table in the section scene. Since $a^2A \ge 0$, the moment of inertia is smallest about the centroid.</p>
<h3>Derived quantities</h3>
$$i = \sqrt{\frac{I}{A}} \;\;(\text{radius of gyration}), \qquad W = \frac{I}{|z|_{\max}} \;\;(\text{section modulus, so that } \sigma_{\max} = M/W)$$` });

  add({ id: 'axis-rotation', title: 'Turning the axes: tensor transformation, eigenvalues, Mohr’s circle', area: 'Linear algebra',
    used: [['Section properties (principal axes)', 'som', 'section'], ['Euler buckling (weak axis)', 'som', 'buckling']],
    body: String.raw`
<p>Turn the axes about the centroid by an angle $\varphi$. A point with coordinates $(y, z)$ has the new coordinates</p>
$$\eta = y\cos\varphi + z\sin\varphi, \qquad \zeta = -y\sin\varphi + z\cos\varphi$$
<h3>The transformation formulas</h3>
<p>Insert $\zeta$ into $I_\eta = \int \zeta^2\,\mathrm dA$ and use $I_{yz} = -\int yz\,\mathrm dA$:</p>
$$I_\eta = \int_A (-y\sin\varphi + z\cos\varphi)^2\,\mathrm dA = I_y\cos^2\varphi + I_z\sin^2\varphi + 2I_{yz}\sin\varphi\cos\varphi$$
<p>With $\cos^2\varphi = \tfrac12(1 + \cos 2\varphi)$, $\sin^2\varphi = \tfrac12(1 - \cos 2\varphi)$ and $2\sin\varphi\cos\varphi = \sin 2\varphi$:</p>
$$I_\eta = \frac{I_y + I_z}{2} + \frac{I_y - I_z}{2}\cos 2\varphi + I_{yz}\sin 2\varphi$$
<p>In the same way, from $\eta\zeta = (z^2 - y^2)\sin\varphi\cos\varphi + yz(\cos^2\varphi - \sin^2\varphi)$:</p>
$$I_{\eta\zeta} = -\frac{I_y - I_z}{2}\sin 2\varphi + I_{yz}\cos 2\varphi$$
<h3>A symmetric tensor</h3>
<p>These are the transformation rules of a symmetric $2\times 2$ tensor, the same as for plane stress:</p>
$$\mathbf I = \begin{pmatrix} I_y & I_{yz} \\ I_{yz} & I_z \end{pmatrix}, \qquad \mathbf I' = \mathbf Q\,\mathbf I\,\mathbf Q^{\mathsf T}, \qquad \mathbf Q = \begin{pmatrix} \cos\varphi & \sin\varphi \\ -\sin\varphi & \cos\varphi \end{pmatrix}$$
<p>Trace and determinant do not change: $I_\eta + I_\zeta = I_y + I_z = I_p$ and $I_\eta I_\zeta - I_{\eta\zeta}^2 = I_y I_z - I_{yz}^2$.</p>
<h3>Principal axes: an extremum, or an eigenvalue problem</h3>
<p>Differentiating, $\mathrm dI_\eta/\mathrm d\varphi = 2I_{\eta\zeta}$, so $I_\eta$ is extreme exactly where the product moment vanishes:</p>
$$I_{\eta\zeta} = 0 \iff \tan 2\varphi^* = \frac{2I_{yz}}{I_y - I_z}$$
<p>Equivalently, the principal values are the eigenvalues of $\mathbf I$:</p>
$$\det(\mathbf I - \lambda\mathbf 1) = \lambda^2 - (I_y + I_z)\lambda + I_y I_z - I_{yz}^2 = 0 \;\Rightarrow\; I_{1,2} = \frac{I_y + I_z}{2} \pm \sqrt{\left(\frac{I_y - I_z}{2}\right)^2 + I_{yz}^2}$$
<p>and the principal axes are its eigenvectors, which are orthogonal because $\mathbf I$ is symmetric. An axis of symmetry is always principal: the contributions to $\int yz\,\mathrm dA$ from mirrored points cancel.</p>
<h3>Mohr’s circle</h3>
<p>Write $m = \tfrac12(I_y + I_z)$ and $d = \tfrac12(I_y - I_z)$. Then $I_\eta - m = d\cos 2\varphi + I_{yz}\sin 2\varphi$ and $I_{\eta\zeta} = -d\sin 2\varphi + I_{yz}\cos 2\varphi$. Squaring and adding removes $\varphi$:</p>
$$(I_\eta - m)^2 + I_{\eta\zeta}^2 = d^2 + I_{yz}^2 = R^2$$
<p>All pairs $(I_\eta, I_{\eta\zeta})$ lie on a circle with centre $(m, 0)$ and radius $R = \tfrac12(I_1 - I_2)$; turning the axes by $\varphi$ moves the point by $2\varphi$ around it.</p>` });

  add({ id: 'linear-stress', title: 'Bending stress: a linear field fitted to three resultants', area: 'Linear systems, Cramer’s rule',
    used: [['Bending stress and the neutral axis', 'som', 'bending'], ['Beam: side view and sections', 'som', 'beam']],
    body: String.raw`
<h3>The assumption: a linear strain field</h3>
<p>Bernoulli: cross-sections stay plane. A plane in the coordinates $(y, z)$ is a linear function, so with Hooke’s law the normal stress is linear too:</p>
$$\varepsilon(y, z) = \varepsilon_0 + \kappa_y z - \kappa_z y \quad\Rightarrow\quad \sigma(y, z) = E\,\varepsilon = a + b\,z + c\,y$$
<h3>Three conditions for three unknowns</h3>
<p>The stresses must add up to the internal forces (centroidal axes, so $\int y\,\mathrm dA = \int z\,\mathrm dA = 0$):</p>
$$N = \int_A \sigma\,\mathrm dA = a A, \qquad M_y = \int_A \sigma z\,\mathrm dA = b\,I_y - c\,I_{yz}, \qquad M_z = -\int_A \sigma y\,\mathrm dA = b\,I_{yz} - c\,I_z$$
<p>(using $\int z^2\,\mathrm dA = I_y$, $\int y^2\,\mathrm dA = I_z$, $\int yz\,\mathrm dA = -I_{yz}$). The last two form a linear system:</p>
$$\begin{pmatrix} I_y & -I_{yz} \\ I_{yz} & -I_z \end{pmatrix} \begin{pmatrix} b \\ c \end{pmatrix} = \begin{pmatrix} M_y \\ M_z \end{pmatrix}, \qquad \det = -(I_y I_z - I_{yz}^2) = -\Delta$$
<h3>Cramer’s rule</h3>
$$b = \frac{\begin{vmatrix} M_y & -I_{yz} \\ M_z & -I_z \end{vmatrix}}{-\Delta} = \frac{I_z M_y - I_{yz} M_z}{\Delta}, \qquad c = \frac{\begin{vmatrix} I_y & M_y \\ I_{yz} & M_z \end{vmatrix}}{-\Delta} = \frac{I_{yz} M_y - I_y M_z}{\Delta}$$
$$\boxed{\;\sigma = \frac{N}{A} + \frac{I_z M_y - I_{yz} M_z}{\Delta}\,z + \frac{I_{yz} M_y - I_y M_z}{\Delta}\,y, \qquad \Delta = I_y I_z - I_{yz}^2\;}$$
<p>$\Delta > 0$ always (it is the determinant of the inertia tensor, the product of the principal moments), so the system is solvable for every section.</p>
<h3>Special cases</h3>
<p>Principal axes ($I_{yz} = 0$): $\sigma = \dfrac{N}{A} + \dfrac{M_y}{I_y}z - \dfrac{M_z}{I_z}y$; with $M_z = 0$ this is Navier’s $\sigma = M z / I$.</p>
<p>The neutral axis is the zero set of a linear function, a straight line; without $N$ it passes through the centroid. It is perpendicular to the moment vector only if the moment acts about a principal axis or $I_1 = I_2$.</p>` });

  add({ id: 'shear-flow', title: 'Shear from bending: balance of a slice, line integrals, closed cells', area: 'Integrals, ODEs along a path',
    used: [['Shear flow and the shear centre', 'som', 'shear'], ['Beam: side view and sections', 'som', 'beam']],
    body: String.raw`
<h3>Why a shear force needs shear stress</h3>
<p>Between $x$ and $x + \mathrm dx$ the bending moment grows by $\mathrm dM = Q\,\mathrm dx$, so the bending stress grows by $\mathrm d\sigma = (Q\,\mathrm dx/I)\,z$. Cut off the part $A^*$ of the slice below the level $z$. In the $x$-direction only the cut can balance the extra normal force:</p>
$$\tau\,b(z)\,\mathrm dx = \int_{A^*} \mathrm d\sigma\,\mathrm dA = \frac{Q\,\mathrm dx}{I}\int_{A^*}\bar z\,\mathrm dA = \frac{Q\,\mathrm dx}{I}\,S(z) \quad\Rightarrow\quad \boxed{\;\tau(z) = \frac{Q\,S(z)}{I\,b(z)}\;}$$
<p>$S(z)$ is the first moment of the cut-off area about the neutral axis.</p>
<h3>The rectangle</h3>
$$S(z) = b\int_z^{h/2}\bar z\,\mathrm d\bar z = \frac{b}{2}\left(\frac{h^2}{4} - z^2\right) \;\Rightarrow\; \tau(z) = \frac{Q}{2I}\left(\frac{h^2}{4} - z^2\right), \qquad \tau_{\max} = \frac{Q h^2}{8I} = \frac{3}{2}\,\frac{Q}{bh}$$
<h3>Thin walls: an ODE along the centre line</h3>
<p>In a thin wall the shear stress runs along the wall; its resultant per length is the shear flow $q = \tau t$. The balance of a wall element $\mathrm ds \times \mathrm dx$ in $x$:</p>
$$\frac{\partial q}{\partial s} + t\,\frac{\partial \sigma}{\partial x} = 0 \;\Rightarrow\; q(s) = q(0) - \frac{Q_z}{I_y}\int_0^s z\,t\,\mathrm ds - \frac{Q_y}{I_z}\int_0^s y\,t\,\mathrm ds$$
<p>(principal axes). At a free edge $q(0) = 0$. The integrals are line integrals along the centre line: constant $z$ in a flange makes $q$ linear, a web with $z$ varying makes $q$ parabolic.</p>
<h3>Closed cells: one more unknown, one compatibility condition</h3>
<p>A closed cell has no free edge. Cut it, compute $q_{\text{open}}$, and add an unknown constant $q_0$. The cell must not twist (the load passes through the shear centre), and the twist of a cell is $\vartheta' = \frac{1}{2A_m}\oint \frac{q}{G t}\,\mathrm ds$:</p>
$$\oint \frac{q_{\text{open}} + q_0}{t}\,\mathrm ds = 0 \;\Rightarrow\; q_0 = -\frac{\oint q_{\text{open}}/t\,\mathrm ds}{\oint \mathrm ds/t}$$
<h3>The shear centre</h3>
<p>The resultant of the shear flow equals $Q$; its line of action follows from the moment about any point:</p>
$$Q_z\,y_M = \int q\,r_\perp\,\mathrm ds$$
<p>Channel: each flange carries $F = \int_0^{b'} \frac{Q t_f h'}{2 I_y} s\,\mathrm ds = \frac{Q t_f h' b'^2}{4 I_y}$; the two flange forces form a couple $F h'$, so $e = \dfrac{F h'}{Q} = \dfrac{t_f\,h'^2 b'^2}{4 I_y}$ outside the web.</p>` });

  add({ id: 'torsion-pde', title: 'Torsion: Poisson’s equation, Fourier series, Bredt', area: 'PDEs, Fourier series',
    used: [['Torsion', 'som', 'torsion']],
    body: String.raw`
<h3>Saint-Venant’s ansatz</h3>
<p>Every cross-section turns rigidly by $\vartheta' x$ and warps out of plane by $\vartheta'\,\psi(y, z)$:</p>
$$u = \vartheta'\,\psi(y, z), \qquad v = -\vartheta'\,x\,z, \qquad w = \vartheta'\,x\,y \quad\Rightarrow\quad \tau_{xy} = G\vartheta'\left(\frac{\partial\psi}{\partial y} - z\right), \;\; \tau_{xz} = G\vartheta'\left(\frac{\partial\psi}{\partial z} + y\right)$$
<h3>A stress function</h3>
<p>Equilibrium $\partial_y\tau_{xy} + \partial_z\tau_{xz} = 0$ holds identically if $\tau_{xy} = \partial_z\Phi$ and $\tau_{xz} = -\partial_y\Phi$. Eliminating $\psi$ (compatibility: $\partial_z\tau_{xy} - \partial_y\tau_{xz} = -2G\vartheta'$) gives Poisson’s equation:</p>
$$\boxed{\;\frac{\partial^2\Phi}{\partial y^2} + \frac{\partial^2\Phi}{\partial z^2} = -2G\vartheta' \text{ in } A, \qquad \Phi = 0 \text{ on the boundary}, \qquad T = 2\int_A \Phi\,\mathrm dA\;}$$
<p>Prandtl’s membrane analogy: a membrane stretched over the outline and inflated obeys the same equation; its slope is the shear stress, its volume half the torque.</p>
<h3>Check: the circle</h3>
$$\Phi = \frac{G\vartheta'}{2}(R^2 - r^2): \quad \nabla^2\Phi = \frac{G\vartheta'}{2}(-4) = -2G\vartheta', \qquad T = G\vartheta'\int_A (R^2 - r^2)\,\mathrm dA = G\vartheta'\left(\pi R^4 - \frac{\pi R^4}{2}\right) = G\vartheta'\,I_p$$
<p>and $\tau = |\nabla\Phi| = G\vartheta' r = T r / I_p$.</p>
<h3>The rectangle by a Fourier series</h3>
<p>Take $-b/2 < y < b/2$, $-h/2 < z < h/2$, $b \le h$. Expand in cosines that vanish at $y = \pm b/2$, $k_n = n\pi/b$ with $n$ odd. The constant right-hand side has the series $-2G\vartheta' = \sum c_n\cos k_n y$ with</p>
$$c_n = \frac{2}{b}\int_{-b/2}^{b/2}(-2G\vartheta')\cos k_n y\,\mathrm dy = -\frac{8G\vartheta'}{n\pi}(-1)^{(n-1)/2}$$
<p>Each mode gives an ODE in $z$, $f_n'' - k_n^2 f_n = c_n$ with $f_n(\pm h/2) = 0$, solved by</p>
$$f_n(z) = -\frac{c_n}{k_n^2}\left(1 - \frac{\cosh k_n z}{\cosh(k_n h/2)}\right), \qquad \Phi = \frac{8G\vartheta' b^2}{\pi^3}\sum_{n\,\text{odd}} \frac{(-1)^{(n-1)/2}}{n^3}\left(1 - \frac{\cosh k_n z}{\cosh(k_n h/2)}\right)\cos k_n y$$
<p>Integrating $2\Phi$ over the rectangle gives the torsion constant</p>
$$I_T = \frac{h b^3}{3}\left[1 - \frac{192}{\pi^5}\frac{b}{h}\sum_{n\,\text{odd}}\frac{1}{n^5}\tanh\frac{n\pi h}{2b}\right] \;\xrightarrow{\;h \gg b\;}\; \frac{h b^3}{3}$$
<p>which is where the thin-strip formula $I_T = \tfrac13\sum l t^3$ for open walls comes from.</p>
<h3>Closed thin walls: Bredt</h3>
<p>Across a thin closed wall $\Phi$ rises from $0$ outside to a constant $\Phi_0$ on the inner boundary, so $q = \tau t = \Phi_0$ is the same all around. The torque of a constant flow is twice the enclosed area times $q$ (each $r_\perp\,\mathrm ds$ is twice a thin triangle):</p>
$$T = \oint q\,r_\perp\,\mathrm ds = 2A_m q, \qquad \vartheta' = \frac{1}{2A_m}\oint\frac{q}{G t}\,\mathrm ds \;\Rightarrow\; I_T = \frac{4A_m^2}{\oint \mathrm ds/t}$$` });

  add({ id: 'beam-ode', title: 'The beam equation: curvature, four integrations, boundary conditions', area: 'Ordinary differential equations',
    used: [['The elastic line', 'som', 'elastic'], ['Beam: side view and sections', 'som', 'beam']],
    body: String.raw`
<h3>Equilibrium of a beam element</h3>
<p>A slice $\mathrm dx$ with the line load $q$ (downwards, like $w$): the vertical forces and the moments balance when</p>
$$\frac{\mathrm dQ}{\mathrm dx} = -q, \qquad \frac{\mathrm dM}{\mathrm dx} = Q$$
<h3>Curvature and the moment</h3>
<p>The curvature of the deflection curve $w(x)$ is exact as $\kappa = w''/(1 + w'^2)^{3/2}$; for small slopes $w'^2 \ll 1$, so $\kappa \approx w''$. With plane sections and Hooke, $\kappa = M/(EI)$ in magnitude; with $w$ and $z$ downwards a sagging moment ($M > 0$) makes $w'' < 0$:</p>
$$E I\,w'' = -M, \qquad \varphi = -w'$$
<p>Together, for constant $EI$:</p>
$$\boxed{\;E I\,w'''' = q\;}$$
<h3>Four integrations</h3>
$$Q = -\int q\,\mathrm dx + C_1, \quad M = \int Q\,\mathrm dx + C_2, \quad E I\varphi = \int M\,\mathrm dx + C_3, \quad w = -\int \varphi\,\mathrm dx + C_4$$
<p>Four constants need four conditions, two at each end:</p>
<table class="sttab"><tr><th>support</th><th>conditions</th></tr><tr><td>clamped</td><td>$w = 0,\ \varphi = 0$</td></tr><tr><td>pinned</td><td>$w = 0,\ M = 0$</td></tr><tr><td>guided (slide)</td><td>$\varphi = 0,\ Q = 0$</td></tr><tr><td>free</td><td>$M = 0,\ Q = 0$</td></tr></table>
<p>The conditions are linear in $C_1 \dots C_4$: a $4\times4$ linear system, singular exactly when the supports allow a rigid motion (a mechanism). Statically indeterminate beams need nothing extra.</p>
<h3>Worked example: cantilever under uniform load</h3>
<p>Clamped at $x = 0$, free at $x = L$. From the free end, $Q = q(L - x)$, $M = -\tfrac{q}{2}(L - x)^2$. Then</p>
$$E I w'' = \frac{q}{2}(L - x)^2 \;\Rightarrow\; E I w' = -\frac{q}{6}(L - x)^3 + \frac{qL^3}{6} \;\Rightarrow\; E I w = \frac{q}{24}(L - x)^4 + \frac{qL^3}{6}x - \frac{qL^4}{24}$$
<p>(constants from $w'(0) = 0$ and $w(0) = 0$). At the tip: $E I\,w(L) = \tfrac{qL^4}{6} - \tfrac{qL^4}{24} = \tfrac{qL^4}{8}$.</p>
<h3>Point loads and couples: jumps</h3>
<p>A force $F$ at $x = a$ makes $Q$ jump by $-F$; a couple $\hat M$ makes $M$ jump by $\hat M$. With Macaulay brackets $\langle x - a\rangle^n$ ($= 0$ for $x < a$) the integrations still run over the whole span:</p>
$$Q = C_1 - \int q\,\mathrm dx - F\langle x - a\rangle^0, \qquad M = C_2 + \int Q\,\mathrm dx + \hat M\langle x - b\rangle^0, \;\ldots$$
<h3>Timoshenko: shear deformation</h3>
<p>The cross-section is allowed to tilt against the axis by the shear angle $\gamma = Q/(\kappa G A)$:</p>
$$w' = -\varphi + \frac{Q}{\kappa G A} \;\Rightarrow\; w_{\text{tip}} = \frac{F L^3}{3EI} + \frac{F L}{\kappa G A} \;\;(\text{cantilever, tip load})$$
<p>The ratio of the two terms is $3EI/(\kappa G A L^2) \sim (E/G)(h/L)^2$: it matters only for short, deep beams.</p>` });

  add({ id: 'energy', title: 'Energy methods: strain energy, Castigliano, Menabrea', area: 'Partial derivatives, quadratic forms',
    used: [['Castigliano and Menabrea', 'som', 'energy']],
    body: String.raw`
<h3>Strain energy</h3>
<p>A linear elastic material stores $\tfrac12\sigma\varepsilon = \sigma^2/(2E)$ per volume. Integrating over a cross-section with $\sigma = M z/I$:</p>
$$\int_A \frac{\sigma^2}{2E}\,\mathrm dA = \frac{M^2}{2EI^2}\int_A z^2\,\mathrm dA = \frac{M^2}{2EI} \quad\Rightarrow\quad U = \int \frac{M^2}{2EI}\,\mathrm dx + \int \frac{N^2}{2EA}\,\mathrm dx + \int \frac{\kappa Q^2}{2GA}\,\mathrm dx$$
<h3>Castigliano’s theorem</h3>
<p>In a linear structure every displacement is a linear combination of the loads, $\delta_i = \sum_j a_{ij}F_j$, with symmetric flexibilities $a_{ij} = a_{ji}$ (Maxwell–Betti). The work of slowly applied loads is stored as energy:</p>
$$U = \frac12\sum_i F_i\,\delta_i = \frac12\sum_{i,j} a_{ij}F_iF_j \quad\Rightarrow\quad \frac{\partial U}{\partial F_k} = \frac12\sum_j a_{kj}F_j + \frac12\sum_i a_{ik}F_i = \sum_j a_{kj}F_j = \delta_k$$
<p>The symmetry $a_{ik} = a_{ki}$ is what makes the two halves equal. Differentiating under the integral:</p>
$$\delta_k = \frac{\partial U}{\partial F_k} = \int \frac{M}{EI}\,\frac{\partial M}{\partial F_k}\,\mathrm dx + \ldots$$
<p>$\partial M/\partial F_k$ is the moment of a unit load at $k$: the unit-load method. Where no load acts, put a dummy load there, differentiate, then set it to zero.</p>
<h3>Worked example: quarter circle</h3>
<p>Clamped at one end, force $F$ at the free end, $M(\varphi) = FR\sin\varphi$, $\mathrm ds = R\,\mathrm d\varphi$:</p>
$$\delta_v = \frac{1}{EI}\int_0^{\pi/2} FR\sin\varphi\cdot R\sin\varphi\cdot R\,\mathrm d\varphi = \frac{FR^3}{EI}\int_0^{\pi/2}\sin^2\varphi\,\mathrm d\varphi = \frac{FR^3}{EI}\cdot\frac{\pi}{4}$$
<p>using $\int_0^{\pi/2}\sin^2\varphi\,\mathrm d\varphi = \left[\tfrac{\varphi}{2} - \tfrac{\sin 2\varphi}{4}\right]_0^{\pi/2} = \tfrac{\pi}{4}$. The horizontal displacement with a dummy force $H$, $\partial M/\partial H = -R(1 - \cos\varphi)$:</p>
$$\delta_h = -\frac{FR^3}{EI}\int_0^{\pi/2}(\sin\varphi - \sin\varphi\cos\varphi)\,\mathrm d\varphi = -\frac{FR^3}{EI}\left(1 - \frac12\right) = -\frac{FR^3}{2EI}$$
<h3>Menabrea: the redundant minimises the energy</h3>
<p>If $X$ is a redundant force whose point does not move, $\partial U/\partial X = 0$. Because $\partial^2 U/\partial X^2 = \int (\partial M/\partial X)^2/(EI)\,\mathrm dx > 0$, this stationary point is a minimum.</p>
<p>Ring pressed by two forces $F$: by symmetry cut at the horizontal diameter, normal force $F/2$ and an unknown moment $X$; $M(\varphi) = X - \tfrac{FR}{2}(1 - \cos\varphi)$, $\partial M/\partial X = 1$:</p>
$$\frac{\partial U}{\partial X} = \frac{4R}{EI}\int_0^{\pi/2}\left[X - \frac{FR}{2}(1 - \cos\varphi)\right]\mathrm d\varphi = \frac{4R}{EI}\left[X\frac{\pi}{2} - \frac{FR}{2}\left(\frac{\pi}{2} - 1\right)\right] = 0 \;\Rightarrow\; X = FR\left(\frac12 - \frac1\pi\right)$$` });

  add({ id: 'buckling-eigen', title: 'Buckling as an eigenvalue problem', area: 'Linear ODEs, eigenvalues',
    used: [['Euler buckling', 'som', 'buckling']],
    body: String.raw`
<h3>Equilibrium in the bent position</h3>
<p>A pin-ended column held slightly bent: the force $F$ acts with the lever arm $w$, so $M = F w$ and</p>
$$E I\,w'' = -F w \quad\Rightarrow\quad w'' + k^2 w = 0, \qquad k^2 = \frac{F}{EI}$$
<h3>Non-trivial solutions only for special $k$</h3>
<p>The general solution is $w = A\sin kx + B\cos kx$. The boundary conditions are a homogeneous linear system for $(A, B)$:</p>
$$w(0) = 0:\; B = 0, \qquad w(L) = 0:\; A\sin kL = 0$$
<p>A bent shape ($A \ne 0$) exists only if the determinant vanishes, $\sin kL = 0$, i.e. $kL = n\pi$: an eigenvalue problem with eigenvalues and eigenfunctions</p>
$$F_n = \frac{n^2\pi^2 EI}{L^2}, \qquad w_n = \sin\frac{n\pi x}{L}$$
<h3>Other supports</h3>
<p>For general end conditions use the fourth-order form $EI\,w'''' + F w'' = 0$ with $w = A + Bx + C\cos kx + D\sin kx$. Four boundary conditions give a $4\times4$ determinant:</p>
<table class="sttab"><tr><th>ends</th><th>characteristic equation</th><th>first root $kL$</th><th>$\beta = \pi/kL$</th></tr>
<tr><td>clamped – free</td><td>$\cos kL = 0$</td><td>$\pi/2$</td><td>$2$</td></tr>
<tr><td>pinned – pinned</td><td>$\sin kL = 0$</td><td>$\pi$</td><td>$1$</td></tr>
<tr><td>clamped – pinned</td><td>$\tan kL = kL$</td><td>$4.4934$</td><td>$0.699$</td></tr>
<tr><td>clamped – clamped</td><td>$\sin\frac{kL}{2}\left(2\sin\frac{kL}{2} - kL\cos\frac{kL}{2}\right) = 0$</td><td>$2\pi$</td><td>$0.5$</td></tr></table>
<p>So $F_k = \pi^2 EI/(\beta L)^2$ with the buckling length $L_k = \beta L$. The higher roots give the higher modes (for clamped–clamped they alternate between symmetric, $kL = 2\pi, 4\pi, \ldots$, and antisymmetric, $\tan\frac{kL}{2} = \frac{kL}{2}$: $kL = 8.987, 15.45, \ldots$).</p>
<h3>Why real columns bend before $F_k$: the imperfect column</h3>
<p>Let the unloaded column have a small bow $w_0 = e\sin(\pi x/L)$. Only the change of curvature is elastic: $EI(w - w_0)'' = -F w$. Try $w = a\sin(\pi x/L)$:</p>
$$-EI\frac{\pi^2}{L^2}(a - e) = -F a \;\Rightarrow\; a\,(F_k - F) = F_k\,e \;\Rightarrow\; \boxed{\;w_{\max} = \frac{e}{1 - F/F_k}\;}$$
<p>The deflection grows without bound as $F \to F_k$: the load–deflection curve has $F = F_k$ as its asymptote.</p>
<h3>From the imperfect column to the design curve</h3>
<p>Yield at the extreme fibre, $\sigma = \frac{N}{A} + \frac{N\,w_{\max}}{W} = f_y$, with $w_{\max} = e/(1 - N/N_{cr})$ is the Ayrton–Perry condition. With $\chi = \sigma/f_y$, $\bar\lambda^2 = f_y/\sigma_{cr}$ and the imperfection written as $\eta = \alpha(\bar\lambda - 0.2)$:</p>
$$(1 - \chi)(1 - \chi\bar\lambda^2) = \eta\,\chi \;\Rightarrow\; \bar\lambda^2\chi^2 - (1 + \eta + \bar\lambda^2)\chi + 1 = 0$$
<p>The smaller root, with $2\Phi = 1 + \alpha(\bar\lambda - 0.2) + \bar\lambda^2$, after rationalising:</p>
$$\chi = \frac{\Phi - \sqrt{\Phi^2 - \bar\lambda^2}}{\bar\lambda^2} = \frac{1}{\Phi + \sqrt{\Phi^2 - \bar\lambda^2}}$$
<p>which is the buckling-curve formula of the steel design code ($\alpha = 0.34$ for curve b).</p>` });

  add({ id: 'bars', title: 'Bars: strain, compatibility and the indeterminate bar', area: 'Integrals, linear equations',
    used: [['Bars: tension and compression', 'som', 'bars']],
    body: String.raw`
<h3>Kinematics and material</h3>
<p>The axial displacement $u(x)$ defines the strain $\varepsilon = u'$. Hooke with thermal expansion:</p>
$$\varepsilon = \frac{N}{EA} + \alpha\,\Delta T \quad\Rightarrow\quad \Delta l = u(L) - u(0) = \int_0^L\left(\frac{N}{EA} + \alpha\,\Delta T\right)\mathrm dx$$
<p>For piecewise constant $N$, $EA$: $\Delta l = \sum_i \dfrac{N_i L_i}{E_i A_i} + \alpha\,\Delta T\,L$.</p>
<h3>Equilibrium</h3>
<p>A distributed axial load $n(x)$ changes the normal force, $N' = -n$; point loads make $N$ jump.</p>
<h3>Statically indeterminate: add a compatibility condition</h3>
<p>Bar between two walls, force $F$ at the step: one redundant $N_1 = N$, $N_2 = N - F$. The walls do not move, so</p>
$$\frac{N L_1}{EA_1} + \frac{(N - F)L_2}{EA_2} + \alpha\,\Delta T(L_1 + L_2) = 0 \;\Rightarrow\; N = \frac{F\,L_2/(EA_2) - \alpha\,\Delta T\,L}{L_1/(EA_1) + L_2/(EA_2)}$$
<p>Heated without load: $\sigma = -E\alpha\Delta T$, independent of the length.</p>
<h3>Bars in parallel</h3>
<p>Same elongation, forces add up: $N_1 + N_2 = F$, $\frac{N_1}{E_1A_1} + \alpha_1\Delta T = \frac{N_2}{E_2A_2} + \alpha_2\Delta T$. Two linear equations; without $\Delta T$ the load splits like springs in parallel, $N_i = F\,\dfrac{E_iA_i}{\sum E A}$.</p>` });

  N.byId = (id) => N.list.find((a) => a.id === id);
})(typeof window !== 'undefined' ? window : globalThis);
