document.addEventListener('DOMContentLoaded', () => {

    /* =========================================
       BACKGROUND : ambiance par section
       Chaque section a sa teinte. En scrollant, le fond passe en
       douceur d'une teinte à l'autre.
    ========================================= */
    (() => {
        const bg = document.querySelector('.bg-container');
        if (!bg) return;

        // Une ambiance par section, en 2 couches :
        //   - angle / top / bottom : dégradé linéaire de base
        //   - lx / ly / light      : grande source de lumière ancrée sur un bord (position en %)
        // Tout est interpolé au scroll : la lumière "voyage" d'un bord à l'autre.
        // La 1re section commence en #05070a pour rester raccord avec la vidéo du hero.
        // Palette relevée sur la vidéo du hero (FInal4.mp4), bleu pétrole :
        //   lumineux 6,53,73 (haut gauche) · moyen 13,36,48 · profond 8,21,28
        const AMBIANCES = [
            // courbe en S : du coin haut droit au coin bas gauche.
            // curve = 2 points de contrôle [x1, y1, x2, y2] (Bézier cubique) vers l'ambiance suivante :
            // la lumière descend en s'écartant à droite, puis balaie vers la gauche en ondulant
            { sel: '#propos',         angle: 180, top: [5, 7, 10],  bottom: [5, 9, 12],  lx: 95, ly: 8, curve: [140, 75, -40, 25], light: [8, 33, 45] },
            { sel: '#expertise',      angle: 160, top: [5, 8, 11],  bottom: [6, 15, 20], lx: -10, ly: 110, light: [7, 40, 55] },
            { sel: '.projets-header', angle: 200, top: [5, 12, 17], bottom: [5, 7, 10],  lx: 110, ly: 65,  light: [9, 38, 52] },
            { sel: '#qna',            angle: 180, top: [5, 7, 10],  bottom: [7, 17, 23], lx: 15,  ly: 115, light: [8, 30, 41] },
            // final : la teinte la plus lumineuse de la vidéo
            { sel: '#contact',        angle: 170, top: [6, 16, 22], bottom: [4, 7, 9],   lx: 55,  ly: 120, light: [6, 53, 73] }
        ];

        // Accueil : chaque ambiance est calée sur sa section
        let STOPS = AMBIANCES.map(s => ({ ...s, el: document.querySelector(s.sel) })).filter(s => s.el);
        const isHome = STOPS.length >= 2;

        // Autres pages : on se cale sur leurs propres blocs et on répartit
        // les 5 ambiances dans l'ordre sur toute la hauteur de la page
        // (noir en haut → lumière pétrole la plus forte en bas, comme l'accueil).
        //   - pages projet : en-tête + sections
        //   - catalogue des projets : en-tête + chaque ligne de cartes + footer
        const targets = isHome ? [] : [...document.querySelectorAll(
            '.pd-minimal-hero, .pd-section, .projects-hero, .project-grid-card, .footer-reveal-wrapper'
        )];
        if (!isHome && targets.length < 2) return; // pages sans blocs reconnus : fond inchangé

        let tops = [];
        const measure = () => {
            const pageTop = el => el.getBoundingClientRect().top + window.scrollY;
            if (isHome) {
                tops = STOPS.map(s => pageTop(s.el));
                return;
            }
            // Positions triées des blocs visibles, en regroupant ceux qui sont trop
            // proches (cartes d'une même rangée, titre collé à la grille...) :
            // une nouvelle étape seulement tous les 40 % d'écran au minimum
            const minGap = window.innerHeight * 0.4;
            const rows = targets
                .filter(el => el.getBoundingClientRect().height > 0)
                .map(el => ({ el, top: pageTop(el) }))
                .sort((a, b) => a.top - b.top)
                .reduce((acc, r) => {
                    if (!acc.length || r.top - acc[acc.length - 1].top > minGap) acc.push(r);
                    return acc;
                }, []);
            const last = AMBIANCES.length - 1;
            STOPS = rows.map((r, i) => ({
                ...AMBIANCES[rows.length > 1 ? Math.round(i * last / (rows.length - 1)) : 0],
                el: r.el
            }));
            tops = rows.map(r => r.top);
        };

        const smooth = v => { v = Math.min(Math.max(v, 0), 1); return v * v * (3 - 2 * v); };

        // Position continue dans la liste des sections (ex. 1.4 = entre 02 et 03)
        const progress = () => {
            const vh = window.innerHeight;
            const probe = window.scrollY + vh * 0.5;
            if (probe < tops[0]) return 0;
            for (let i = 0; i < tops.length - 1; i++) {
                if (probe < tops[i + 1]) {
                    // Durée de la transition avant la section suivante :
                    // ~1,2 écran, sans dépasser la hauteur de la section
                    const zone = Math.min(vh * 1.2, tops[i + 1] - tops[i]);
                    return i + smooth((probe - (tops[i + 1] - zone)) / zone);
                }
            }
            return tops.length - 1;
        };

        let ticking = false;
        const update = () => {
            ticking = false;
            if (STOPS.length < 2) return;
            const p = progress();
            const a = Math.floor(p), b = Math.min(a + 1, STOPS.length - 1), f = p - a;
            const A = STOPS[a], B = STOPS[b];
            const n = (x, y) => x + (y - x) * f;
            const col = (x, y) => x.map((v, i) => Math.round(n(v, y[i]))).join(',');
            const light = col(A.light, B.light);
            // Position de la lumière : ligne droite par défaut,
            // courbe (Bézier cubique) si la section a des points de contrôle "curve"
            let px = n(A.lx, B.lx), py = n(A.ly, B.ly);
            // (seulement si la lumière change vraiment de place : deux sections
            // consécutives peuvent partager la même ambiance sur les pages projet)
            if (A.curve && (A.lx !== B.lx || A.ly !== B.ly)) {
                const [x1, y1, x2, y2] = A.curve, u = 1 - f;
                const w0 = u * u * u, w1 = 3 * u * u * f, w2 = 3 * u * f * f, w3 = f * f * f;
                px = w0 * A.lx + w1 * x1 + w2 * x2 + w3 * B.lx;
                py = w0 * A.ly + w1 * y1 + w2 * y2 + w3 * B.ly;
            }
            bg.style.background =
                // Lumière large au fondu très progressif (courbe proche d'une gaussienne)
                `radial-gradient(ellipse 130% 115% at ${px.toFixed(1)}% ${py.toFixed(1)}%,` +
                `rgba(${light},1) 0%, rgba(${light},0.85) 12%, rgba(${light},0.62) 25%, ` +
                `rgba(${light},0.4) 38%, rgba(${light},0.22) 52%, rgba(${light},0.09) 66%, ` +
                `rgba(${light},0.02) 80%, rgba(${light},0) 92%), ` +
                `linear-gradient(${n(A.angle, B.angle).toFixed(1)}deg, rgb(${col(A.top, B.top)}), rgb(${col(A.bottom, B.bottom)}))`;
        };
        const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };

        measure();
        update();
        window.addEventListener('scroll', request, { passive: true });
        window.addEventListener('resize', () => { measure(); request(); });
        window.addEventListener('load', () => { measure(); request(); }); // images chargées = hauteurs finales
    })();

    /* =========================================
       0. ENTRANCE LOADER
    ========================================= */
    const loader = document.getElementById('loader');
    const heroVideo = document.getElementById('hero-video');
    if (loader) {
        document.body.classList.add('no-scroll');
        setTimeout(() => {
            loader.classList.add('fade-out');
            document.body.classList.remove('no-scroll');
            if (heroVideo) {
                heroVideo.currentTime = 0;
                heroVideo.play();
            }
        }, 1800);
    }

    /* =========================================
       1. CUSTOM CURSOR TRACKING
    ========================================= */
    const cursor = document.querySelector('.custom-cursor');
    const glow = document.getElementById('glow');

    if (window.innerWidth > 768) {
        document.body.addEventListener('mousemove', (e) => {
            requestAnimationFrame(() => {
                // Background glow
                if (glow) glow.style.transform = `translate(calc(${e.clientX}px - 50%), calc(${e.clientY}px - 50%))`;

                // Point Cursor tracking
                if (cursor) cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
            });
        });

        if (cursor) {
            // Add hover state for links and buttons
            const interactables = document.querySelectorAll('a, button, .btn');
            interactables.forEach(el => {
                el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
                el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
            });

            // Specific "Voir" tag for project cards
            const projects = document.querySelectorAll('.project-card, .project-grid-card');
            projects.forEach(el => {
                el.addEventListener('mouseenter', () => cursor.classList.add('viewing'));
                el.addEventListener('mouseleave', () => cursor.classList.remove('viewing'));
            });
        }
    }

    /* =========================================
       1b. LIGHTBOX : agrandir les images des pages projet
       Clic sur une image → plein écran. Navigation ← → entre
       les images de la page, fermeture par Échap / croix / clic à côté.
    ========================================= */
    (() => {
        const SELECTOR = '.pd-media-content img, .pd-gallery-item img, .cz-screen-img img';
        const images = [...document.querySelectorAll(SELECTOR)];
        if (!images.length) return;

        // Construction de la lightbox (une seule pour la page)
        const box = document.createElement('div');
        box.className = 'lightbox';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.setAttribute('aria-label', 'Image agrandie');
        box.innerHTML = `
            <button class="lightbox-btn lightbox-close" aria-label="Fermer">✕</button>
            <button class="lightbox-btn lightbox-prev" aria-label="Image précédente">←</button>
            <figure class="lightbox-figure">
                <img class="lightbox-img" alt="">
                <figcaption class="lightbox-caption">
                    <span class="lightbox-count"></span>
                    <span class="lightbox-text"></span>
                </figcaption>
            </figure>
            <button class="lightbox-btn lightbox-next" aria-label="Image suivante">→</button>`;
        document.body.appendChild(box);

        const img = box.querySelector('.lightbox-img');
        const count = box.querySelector('.lightbox-count');
        const text = box.querySelector('.lightbox-text');
        const prevBtn = box.querySelector('.lightbox-prev');
        const nextBtn = box.querySelector('.lightbox-next');
        const closeBtn = box.querySelector('.lightbox-close');
        let current = 0;
        let lastFocus = null;

        const show = (i) => {
            current = (i + images.length) % images.length;
            const src = images[current];
            img.src = src.currentSrc || src.src;
            img.alt = src.alt || '';
            text.textContent = src.alt || '';
            count.textContent = `${current + 1} / ${images.length}`;
        };

        const open = (i) => {
            lastFocus = document.activeElement;
            show(i);
            box.classList.add('open');
            document.body.style.overflow = 'hidden';
            closeBtn.focus();
        };

        const close = () => {
            box.classList.remove('open');
            document.body.style.overflow = '';
            if (lastFocus) lastFocus.focus();
        };

        const single = images.length < 2;
        prevBtn.hidden = single;
        nextBtn.hidden = single;

        images.forEach((el, i) => {
            el.classList.add('is-zoomable');
            el.setAttribute('tabindex', '0');
            el.setAttribute('role', 'button');
            el.addEventListener('click', () => open(i));
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); }
            });
        });

        prevBtn.addEventListener('click', (e) => { e.stopPropagation(); show(current - 1); });
        nextBtn.addEventListener('click', (e) => { e.stopPropagation(); show(current + 1); });
        closeBtn.addEventListener('click', close);
        // Clic à côté de l'image (fond ou zone vide) → fermer
        box.addEventListener('click', (e) => {
            if (e.target === box || e.target.classList.contains('lightbox-figure')) close();
        });

        document.addEventListener('keydown', (e) => {
            if (!box.classList.contains('open')) return;
            if (e.key === 'Escape') close();
            else if (e.key === 'ArrowLeft' && !single) show(current - 1);
            else if (e.key === 'ArrowRight' && !single) show(current + 1);
        });

        // Curseur personnalisé : étiquette "Agrandir" sur les images,
        // grossissement sur les boutons de la lightbox
        const cur = document.querySelector('.custom-cursor');
        const tag = cur && cur.querySelector('.cursor-tag');
        if (cur && tag && window.innerWidth > 768) {
            const defaultLabel = tag.textContent;
            images.forEach(el => {
                el.addEventListener('mouseenter', () => { tag.textContent = 'Agrandir'; cur.classList.add('viewing'); });
                el.addEventListener('mouseleave', () => { cur.classList.remove('viewing'); tag.textContent = defaultLabel; });
            });
            box.querySelectorAll('.lightbox-btn').forEach(b => {
                b.addEventListener('mouseenter', () => cur.classList.add('hover'));
                b.addEventListener('mouseleave', () => cur.classList.remove('hover'));
            });
            img.addEventListener('click', () => { cur.classList.remove('viewing'); tag.textContent = defaultLabel; });
        }
    })();

    /* =========================================
       1c. FILTRES PAR DOMAINE (page projets)
       Chaque carte porte data-domains="communication uxui ..." ;
       les boutons data-filter masquent les cartes qui ne correspondent pas.
    ========================================= */
    (() => {
        const filterBtns = [...document.querySelectorAll('.filter-btn')];
        const gridCards = [...document.querySelectorAll('.project-grid-card[data-domains]')];
        if (!filterBtns.length || !gridCards.length) return;
        const countEl = document.querySelector('.projects-count');

        const matches = (card, filter) =>
            filter === 'all' || card.dataset.domains.split(/\s+/).includes(filter);

        // Nombre de projets par filtre ; un filtre sans projet est masqué
        filterBtns.forEach(btn => {
            const n = gridCards.filter(card => matches(card, btn.dataset.filter)).length;
            const badge = btn.querySelector('.filter-count');
            if (badge) badge.textContent = n;
            if (n === 0) btn.hidden = true;
        });

        const apply = (filter) => {
            let visible = 0;
            gridCards.forEach(card => {
                const show = matches(card, filter);
                const wasHidden = card.classList.contains('is-hidden');
                card.classList.toggle('is-hidden', !show);
                card.classList.remove('is-entering');
                if (show) {
                    visible++;
                    if (wasHidden) { void card.offsetWidth; card.classList.add('is-entering'); }
                }
            });
            filterBtns.forEach(btn => {
                const on = btn.dataset.filter === filter;
                btn.classList.toggle('is-active', on);
                btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            if (countEl) countEl.textContent = `/ ${visible}`;
            // la hauteur de la page change : le fond dégradé se recale
            window.dispatchEvent(new Event('resize'));
        };

        filterBtns.forEach(btn => btn.addEventListener('click', () => apply(btn.dataset.filter)));
    })();

    /* =========================================
       2. SMOOTH BLUR REVEAL (Framer style)
    ========================================= */
    const revealElements = document.querySelectorAll('.reveal');

    const revealOptions = {
        threshold: 0.15,
        rootMargin: "0px 0px -50px 0px"
    };

    const revealOnScroll = new IntersectionObserver(function (entries, observer) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, revealOptions);

    revealElements.forEach(el => {
        revealOnScroll.observe(el);
    });

    /* =========================================
       2b. SECTION DIVIDERS ANIMATION
    ========================================= */
    const dividers = document.querySelectorAll('.section-divider');
    const dividerObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.5 });

    dividers.forEach(divider => dividerObserver.observe(divider));


    /* =========================================
       4. MOBILE MENU TOGGLE
    ========================================= */
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileLinks = document.querySelectorAll('.mobile-nav-links a');

    if (hamburger && mobileMenu) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            mobileMenu.classList.toggle('active');
            document.body.classList.toggle('no-scroll');
        });

        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                mobileMenu.classList.remove('active');
                document.body.classList.remove('no-scroll');
            });
        });
    }

    /* =========================================
       6. Q&A ACCORDION
    ========================================= */
    const qnaItems = document.querySelectorAll('.qna-item');

    qnaItems.forEach(item => {
        const btn = item.querySelector('.qna-question');
        btn.addEventListener('click', () => {
            const isOpen = item.classList.contains('open');
            // Ferme tous les autres
            qnaItems.forEach(i => i.classList.remove('open'));
            // Ouvre celui cliqué si il était fermé
            if (!isOpen) item.classList.add('open');
        });
    });

    /* =========================================
       7. NAVBAR BEHAVIOR (Framer Style)
    ========================================= */
    const navbar = document.getElementById('navbar');

    window.addEventListener('scroll', () => {
        if (!navbar) return;
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    /* =========================================
       8. LIVE CLOCK (Hero meta bar)
    ========================================= */
    const clockEl = document.getElementById('hero-clock');
    if (clockEl) {
        const updateClock = () => {
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            clockEl.textContent = `${h}:${m}`;
        };
        updateClock();
        setInterval(updateClock, 1000);
    }

    /* =========================================
       5. STICKY CARD STACK (FRAMER 180 FLIP)
    ========================================= */
    const projContainer = document.querySelector('.projects-container');
    if (projContainer) {
        const cards = projContainer.querySelectorAll('.project-card');
        const marquees = projContainer.querySelectorAll('.marquee-bg');
        const cardRotator = projContainer.querySelector('.card-rotator');
        const marqueeRotator = projContainer.querySelector('.marquee-rotator');
        const titlesRotator = projContainer.querySelector('.titles-rotator');
        const titleFaces = projContainer.querySelectorAll('.project-title-face');

        cards.forEach((card, i) => {
            card.style.transform = `rotateX(${-i * 180}deg)`;
        });

        marquees.forEach((marquee, i) => {
            marquee.style.transform = `rotateX(${-i * 180}deg)`;
        });

        if (titleFaces) {
            titleFaces.forEach((face, i) => {
                face.style.transform = `translateY(-50%) rotateX(${-i * 180}deg)`;
            });
        }

        let targetP = 0;
        let currentP = 0;

        window.addEventListener('scroll', () => {
            const rect = projContainer.getBoundingClientRect();
            const scrollY = -rect.top;
            const wH = window.innerHeight;

            // 1. Progress calculation
            let rawProgress = scrollY / wH;
            targetP = Math.max(0, Math.min(cards.length - 1, rawProgress));
        });

        const lerp = (start, end, factor) => start + (end - start) * factor;

        const cardsMobileQuery = window.matchMedia('(max-width: 900px)');

        function animateCards() {
            // Sur mobile, les cartes sont empilées (voir CSS) : pas d'animation 3D
            if (cardsMobileQuery.matches) {
                requestAnimationFrame(animateCards);
                return;
            }
            // Smooth lerp for a very fluid, "drifting" scroll feel
            currentP = lerp(currentP, targetP, 0.05);

            // 2. 180° Flip logic with Premium Smooth Easing
            const intensity = 0.85;
            let easedP = currentP - (Math.sin(2 * Math.PI * currentP) / (2 * Math.PI)) * intensity;

            let globalRotateX = easedP * 180;

            if (cardRotator) {
                cardRotator.style.transform = `rotateX(${globalRotateX}deg)`;
            }
            // Les marquees et titres n'utilisent plus la rotation du parent pour éviter l'effet miroir et permettre le slide
            if (marqueeRotator) {
                marqueeRotator.style.transform = `none`;
            }
            if (titlesRotator) {
                titlesRotator.style.transform = `none`;
            }

            // 3. Card visibility, brightness and scale
            cards.forEach((card, i) => {
                let localRotate = -i * 180;
                let globalRotate = globalRotateX + localRotate;

                if (Math.abs(globalRotate) > 95) {
                    card.style.opacity = 0;
                    card.style.pointerEvents = 'none';
                } else {
                    card.style.opacity = 1;
                    let cosFactor = Math.cos(globalRotate * Math.PI / 180);
                    let scale = 0.85 + (0.15 * cosFactor);
                    card.style.transform = `rotateX(${localRotate}deg) scale(${scale})`;
                    card.style.filter = `brightness(${Math.max(0.3, cosFactor)})`;
                    // On augmente la zone de sélection (cliquable) à 45° pour plus de souplesse
                    card.style.pointerEvents = Math.abs(globalRotate) < 45 ? 'auto' : 'none';
                }
            });

            // 4. Marquee sliding animation (Slicker than rotation)
            marquees.forEach((marquee, i) => {
                // On utilise easedP pour que le slide soit synchronisé avec le "snap" des cartes
                let diff = i - easedP;
                let opacity = 1 - Math.abs(diff) * 3; // Fade plus rapide
                let translateY = diff * 15; // Slide vertical réduit

                if (opacity <= 0) {
                    marquee.style.opacity = 0;
                    marquee.style.visibility = 'hidden';
                } else {
                    marquee.style.opacity = opacity;
                    marquee.style.visibility = 'visible';
                    let blurFactor = Math.abs(diff) * 15;
                    // On inclut -50% pour compenser le top: 50% du CSS et centrer verticalement
                    marquee.style.transform = `translateY(calc(-50% + ${translateY}vh)) scale(${1 - Math.abs(diff) * 0.05})`;
                    marquee.style.filter = `blur(${blurFactor}px) brightness(${1 - Math.abs(diff) * 0.5})`;
                }
            });

            // 5. Title faces sliding animation (Rolling effect)
            if (titleFaces) {
                titleFaces.forEach((face, i) => {
                    let diff = i - easedP;
                    let opacity = 1 - Math.abs(diff) * 4; // Fade très rapide pour ne pas chevaucher
                    let translateY = diff * 50; // Slide beaucoup plus subtil

                    if (opacity <= 0) {
                        face.style.opacity = 0;
                        face.style.visibility = 'hidden';
                    } else {
                        face.style.opacity = opacity;
                        face.style.visibility = 'visible';
                        // On part de -50% (centre) et on ajoute le décalage vertical
                        face.style.transform = `translateY(calc(-50% + ${translateY}px)) scale(${1 - Math.abs(diff) * 0.1})`;
                        face.style.filter = `brightness(${1 - Math.abs(diff) * 0.5})`;
                    }
                });
            }


            requestAnimationFrame(animateCards);
        }

        animateCards();
    }
    /* =========================================
       EXPERTISE INTERACTIVE
    ========================================= */
    const expertiseItems = document.querySelectorAll('.expertise-item');
    const expertisePanel = document.querySelector('.expertise-panel');
    const mobileQuery = window.matchMedia('(max-width: 900px)');

    // Sur mobile, chaque texte est déplacé juste sous son domaine (accordéon) ;
    // sur ordinateur, il retourne dans le panneau de gauche.
    function placeExpertisePanels() {
        expertiseItems.forEach(item => {
            const panel = document.getElementById(item.dataset.panel);
            if (!panel) return;
            if (mobileQuery.matches) item.after(panel);
            else if (expertisePanel) expertisePanel.appendChild(panel);
        });
    }
    if (expertiseItems.length) {
        placeExpertisePanels();
        mobileQuery.addEventListener('change', placeExpertisePanels);
    }

    expertiseItems.forEach(item => {
        item.addEventListener('click', () => {
            expertiseItems.forEach(i => i.classList.remove('active'));
            document.querySelectorAll('.panel-content').forEach(p => p.classList.remove('active'));
            item.classList.add('active');
            document.getElementById(item.dataset.panel).classList.add('active');
        });
    });

    /* =========================================
       READING PROGRESS BAR & PROJECT SCROLLSPY (SOLUTION 2)
    ========================================= */
    const progressBar = document.querySelector('.reading-progress-bar');
    if (progressBar) {
        window.addEventListener('scroll', () => {
            const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
            const currentScroll = window.scrollY;
            if (totalScroll > 0) {
                const progress = (currentScroll / totalScroll) * 100;
                progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
            }
        });
    }

    const pdNavLinks = document.querySelectorAll('.pd-inflow-nav a, .pd-sticky-nav a, .pd-sidebar-nav a, .pd-minimal-nav a');
    const pdSections = document.querySelectorAll('.pd-section');

    if (pdNavLinks.length > 0 && pdSections.length > 0) {
        const pdObserverOptions = {
            root: null,
            rootMargin: '-20% 0px -60% 0px',
            threshold: 0
        };

        const pdObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    pdNavLinks.forEach(link => {
                        if (link.getAttribute('href') === `#${id}`) {
                            link.classList.add('active');
                        } else {
                            link.classList.remove('active');
                        }
                    });
                }
            });
        }, pdObserverOptions);

        pdSections.forEach(sec => {
            if (sec.getAttribute('id')) {
                pdObserver.observe(sec);
            }
        });
    }

});