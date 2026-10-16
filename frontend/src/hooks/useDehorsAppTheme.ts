import {useIsomorphicEffect} from "@mantine/hooks";

const DEHORS_APP_CLASS = 'dehors-app';

export const useDehorsAppTheme = () => {
    useIsomorphicEffect(() => {
        document.body.classList.add(DEHORS_APP_CLASS);
        return () => document.body.classList.remove(DEHORS_APP_CLASS);
    }, []);
};
