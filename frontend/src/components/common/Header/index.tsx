import {Container} from '@mantine/core';
import classes from './Header.module.scss';
import {NavLink} from "react-router";
import { getConfig } from '../../../utilites/config';

interface HeaderProps {
    rightContent?: React.ReactNode;
    fullWidth?: boolean;
    variant?: 'default' | 'floating';
}

export const Header = ({rightContent, fullWidth = false, variant = 'default'}: HeaderProps) => {
    const isFloating = variant === 'floating';
    const logo = isFloating
        ? getConfig("VITE_APP_LOGO_DARK", "/logos/hi-events-text-light.svg")
        : getConfig("VITE_APP_LOGO_LIGHT", "/logos/hi-events-text-dark.svg");

    return (
        <header className={isFloating ? classes.floating : classes.header}>
            <Container size="md" className={classes.inner} fluid={fullWidth}>
                <NavLink className={classes.logo} to={'/manage/events'}>
                    <img src={logo} alt={`${getConfig("VITE_APP_NAME", "Hi.Events")} logo`} className={classes.logo}/>
                </NavLink>

                <div className={classes.rightContent}>
                    {rightContent}
                </div>
            </Container>
        </header>
    );
}
