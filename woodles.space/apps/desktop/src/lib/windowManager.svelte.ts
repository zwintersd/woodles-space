export type WindowState = {
    id: string
    x: number
    y: number
    width: number
    height: number
    zIndex: number
    minimized: boolean
}

class WindowManager {
    windows = $state<WindowState[]>([]);
    nextZ = 10;
    open(id: string, x: number, y: number, width: number, height: number) {
        this.windows.push({
            id,
            x,
            y,
            width,
            height,
            zIndex: this.nextZ++,
            minimized: false
        });
    }
}
export const windowManager = new WindowManager();