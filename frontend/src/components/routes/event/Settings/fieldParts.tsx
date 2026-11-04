import extra from "./EventSettings.module.scss";

// The small pieces of the fields of these settings (Figma: icons in the field, hint under it).

export const fieldIcon = (name: string) => <img src={`/interface/admin/parametres/${name}.svg`} width={20} height={20} alt=""/>;

export const durationIcon = () => <img src="/interface/admin/accueil/horloge.svg" width={20} height={20} alt=""/>;

// The chevron of the mockup at the end of a Select.
export const FIELD_CHEVRON = {
    rightSection: fieldIcon('chevron-bas'),
    rightSectionPointerEvents: 'none' as const,
};

// The hint under the field rather than above it.
export const HINT_UNDER_FIELD = {
    inputWrapperOrder: ['label', 'input', 'description', 'error'] as ('label' | 'input' | 'description' | 'error')[],
    classNames: {description: extra.underHint},
};

// A value set before the list of choices (« 25 minutes ») stays among them.
export const withCurrentOption = (
    options: { value: string, label: string }[],
    current: number | string,
    label: (value: number) => string,
) => {
    if (current === '' || options.some(option => option.value === String(current))) {
        return options;
    }
    return [{value: String(current), label: label(Number(current))}, ...options]
        .sort((a, b) => Number(a.value) - Number(b.value));
};
