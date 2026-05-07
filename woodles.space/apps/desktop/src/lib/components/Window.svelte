<script lang="ts">
    import type { WindowState } from "../windowManager.svelte";
    let { win } = $props<{ win: WindowState }>();
</script>

<div
    style="left: {win.x}px; top: {win.y}px; width: {win.width}px; height: {win.height}px; z-index: {win.zIndex}; "
>
    {win.id}
</div>
