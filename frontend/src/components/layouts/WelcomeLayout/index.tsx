import {Outlet} from "react-router";
import {useDehorsAppTheme} from "../../../hooks/useDehorsAppTheme.ts";

const WelcomeLayout = () => {
    useDehorsAppTheme();

    return (
        <>
            <Outlet/>
        </>
    );
}

export default WelcomeLayout;
