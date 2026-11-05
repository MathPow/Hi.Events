import {Drawer, DrawerProps} from "@mantine/core";
import React from "react";
import classes from "./SideDrawer.module.scss";

interface SideDrawerProps {
    heading?: string | React.ReactNode,
}

export const SideDrawer = (props: DrawerProps & SideDrawerProps) => {
    return (
        <Drawer
            {...props}
            overlayProps={{
                opacity: 0.55,
                blur: 3,
            }}
            position="right"
            size={'xl'}
            withCloseButton={true}
            title={props.heading}
            classNames={{
                content: classes.content,
                header: classes.header,
                title: classes.sideDrawerTitle,
                close: classes.close,
            }}
        >
            <div className={classes.body}>
                {/* Opening focus lands here rather than on the close button (no ring right away). */}
                <div data-autofocus tabIndex={-1} className={classes.focusStart}/>
                {props.children}
            </div>
        </Drawer>
    )
}
