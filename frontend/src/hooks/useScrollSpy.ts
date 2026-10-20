import {useEffect} from "react";

// Reports the section the user has scrolled to inside the back-office scroll container.
export const useScrollSpy = (sectionIds: string[], onChange: (id: string) => void, enabled = true) => {
    const key = sectionIds.join(',');

    useEffect(() => {
        if (!enabled || typeof IntersectionObserver === 'undefined') {
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            const visible = entries.find((entry) => entry.isIntersecting);
            if (visible) {
                onChange(visible.target.id);
            }
        }, {
            root: document.getElementById('app-manage-main'),
            rootMargin: '-15% 0px -80% 0px',
        });

        sectionIds.forEach((id) => {
            const element = document.getElementById(id);
            if (element) {
                observer.observe(element);
            }
        });

        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, enabled]);
};
