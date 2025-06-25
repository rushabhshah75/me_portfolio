const ANIMATION_DURATION = 600;

class PortfolioManager {
    constructor() {
        this.currentSection = 'about';
        this.isAnimating = false;
        this.initializeEventListeners();
        this.initializeIntersectionObserver();
    }

    initializeEventListeners() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => this.handleNavClick(e));
        });
    }

    initializeIntersectionObserver() {
        const sections = document.querySelectorAll('.section');
        const observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            { threshold: 0.5 }
        );
        
        sections.forEach(section => observer.observe(section));
    }

    handleNavClick(e) {
        e.preventDefault();
        
        if (this.isAnimating) return;
        
        const targetSection = e.target.dataset.section;
        if (targetSection === this.currentSection) return;
        
        this.switchSection(targetSection);
    }

    switchSection(targetSection) {
        this.isAnimating = true;
        
        const currentSectionEl = document.getElementById(this.currentSection);
        const targetSectionEl = document.getElementById(targetSection);
        
        this.updateActiveNavLink(targetSection);
        this.animateTransition(currentSectionEl, targetSectionEl, targetSection);
    }

    updateActiveNavLink(targetSection) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        document.querySelector(`[data-section="${targetSection}"]`).classList.add('active');
    }

    animateTransition(currentEl, targetEl, targetSection) {
        // Fade out current section
        currentEl.style.transform = 'translateY(-50px)';
        currentEl.style.opacity = '0';
        
        setTimeout(() => {
            currentEl.classList.remove('active');
            targetEl.classList.add('active');
            
            // Reset target section position
            targetEl.style.transform = 'translateY(50px)';
            targetEl.style.opacity = '0';
            
            // Trigger reflow
            targetEl.offsetHeight;
            
            // Animate in target section
            targetEl.style.transform = 'translateY(0)';
            targetEl.style.opacity = '1';
            
            this.currentSection = targetSection;
            
            setTimeout(() => {
                this.isAnimating = false;
            }, ANIMATION_DURATION);
            
        }, ANIMATION_DURATION / 2);
    }

    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting && !this.isAnimating) {
                const sectionId = entry.target.id;
                if (sectionId !== this.currentSection) {
                    this.updateActiveNavLink(sectionId);
                    this.currentSection = sectionId;
                }
            }
        });
    }
}

class SkillAnimator {
    constructor() {
        this.initializeSkillAnimations();
    }

    initializeSkillAnimations() {
        const skillCards = document.querySelectorAll('.skill-card');
        
        skillCards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
            
            card.addEventListener('mouseenter', () => this.animateSkillHover(card));
            card.addEventListener('mouseleave', () => this.resetSkillAnimation(card));
        });
    }

    animateSkillHover(card) {
        const icon = card.querySelector('.skill-icon');
        icon.style.transform = 'scale(1.2) rotateY(360deg)';
        icon.style.transition = 'transform 0.6s ease';
    }

    resetSkillAnimation(card) {
        const icon = card.querySelector('.skill-icon');
        icon.style.transform = 'scale(1) rotateY(0deg)';
    }
}

class ProjectAnimator {
    constructor() {
        this.initializeProjectAnimations();
    }

    initializeProjectAnimations() {
        const projectCards = document.querySelectorAll('.project-card');
        
        projectCards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.2}s`;
            
            card.addEventListener('mouseenter', () => this.animateProjectHover(card));
            card.addEventListener('mouseleave', () => this.resetProjectAnimation(card));
        });
    }

    animateProjectHover(card) {
        const techStack = card.querySelectorAll('.tech-stack span');
        techStack.forEach((tech, index) => {
            setTimeout(() => {
                tech.style.transform = 'translateY(-5px)';
                tech.style.boxShadow = '0 5px 15px rgba(0, 212, 255, 0.3)';
            }, index * 100);
        });
    }

    resetProjectAnimation(card) {
        const techStack = card.querySelectorAll('.tech-stack span');
        techStack.forEach(tech => {
            tech.style.transform = 'translateY(0)';
            tech.style.boxShadow = 'none';
        });
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    new PortfolioManager();
    new SkillAnimator();
    new ProjectAnimator();
    
    // Add smooth scrolling for better UX
    document.documentElement.style.scrollBehavior = 'smooth';
    
    // Add loading animation
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s ease';
        document.body.style.opacity = '1';
    }, 100);
});