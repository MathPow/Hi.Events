import {ReactNode} from "react";
import {t} from "@lingui/macro";
import {
    closestCenter,
    DndContext,
    DragEndEvent,
    KeyboardSensor,
    Modifier,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import classes from "./OrganizerHomepageDesigner.module.scss";

const verticalOnly: Modifier = ({transform}) => ({...transform, x: 0});

interface SortableRowsProps<T> {
    items: T[];
    getId: (item: T) => string;
    onReorder: (items: T[]) => void;
    children: (item: T) => ReactNode;
}

// The rows of « Réseaux sociaux » and « FAQ », ordered by dragging their handle.
export const SortableRows = <T, >({items, getId, onReorder, children}: SortableRowsProps<T>) => {
    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 4}}),
        useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}),
    );

    const onDragEnd = ({active, over}: DragEndEvent) => {
        if (!over || active.id === over.id) {
            return;
        }
        const ids = items.map(getId);
        onReorder(arrayMove(items, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}
                    modifiers={[verticalOnly]}>
            <SortableContext items={items.map(getId)} strategy={verticalListSortingStrategy}>
                <div className={classes.rows}>
                    {items.map(children)}
                </div>
            </SortableContext>
        </DndContext>
    );
};

interface SortableRowProps {
    id: string;
    className?: string;
    gripSize: 16 | 18;
    children: (grip: ReactNode) => ReactNode;
}

export const SortableRow = ({id, className, gripSize, children}: SortableRowProps) => {
    const {attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging} = useSortable({id});

    const grip = (
        <button
            type="button"
            ref={setActivatorNodeRef}
            className={classes.grip}
            aria-label={t`Drag to reorder`}
            {...attributes}
            {...listeners}
        >
            <img src={`/interface/admin/ma-page/${gripSize === 16 ? 'grip-16' : 'grip'}.svg`} alt=""/>
        </button>
    );

    return (
        <div
            ref={setNodeRef}
            className={`${classes.row} ${className ?? ''}`}
            data-dragging={isDragging || undefined}
            style={{transform: CSS.Transform.toString(transform), transition}}
        >
            {children(grip)}
        </div>
    );
};
