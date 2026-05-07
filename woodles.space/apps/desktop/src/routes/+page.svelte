<script lang="ts">
    import { windowManager } from "$lib/windowManager.svelte";
    import Window from "$lib/components/Window.svelte";

    const colors = [
        { bg: "rgba(201, 191, 238, 0.45)", border: "#c9bfee", dot: "#9d8fd4" },
        { bg: "rgba(168, 221, 224, 0.4)", border: "#a8dde0", dot: "#5db8bd" },
        { bg: "rgba(242, 212, 194, 0.45)", border: "#f2d4c2", dot: "#d4956a" },
        { bg: "rgba(217, 196, 240, 0.4)", border: "#d9c4f0", dot: "#a87dd4" },
    ];
</script>

<div class="desktop-surface">
    <button
        class="spawn"
        onclick={() => windowManager.open("manifest", 100, 100, 200, 200)}
    >
        <span class="spawn-icon">✦</span>
        manifest
    </button>

    {#each windowManager.windows as win}
  <Window win={win} />
{/each}
        {@const color = colors[i % colors.length]}
        <div
            class="window-card"
            style="
				left: {win.x + i * 24}px;
				top: {win.y + i * 24}px;
				width: {win.width}px;
				background: {color.bg};
				border-color: {color.border};
				z-index: {win.zIndex};
			"
        >
            <div class="window-titlebar" style="border-color: {color.border}">
                <span class="window-dot" style="background: {color.dot}"></span>
                <span
                    class="window-dot"
                    style="background: {color.dot}; opacity: 0.6"
                ></span>
                <span
                    class="window-dot"
                    style="background: {color.dot}; opacity: 0.3"
                ></span>
                <span class="window-title">{win.id}</span>
            </div>
            <div class="window-body">
                <div class="window-meta">
                    <span class="meta-label">position</span>
                    <span class="meta-value">{win.x}, {win.y}</span>
                </div>
                <div class="window-meta">
                    <span class="meta-label">size</span>
                    <span class="meta-value">{win.width} × {win.height}</span>
                </div>
                <div class="window-meta">
                    <span class="meta-label">layer</span>
                    <span class="meta-value">{win.zIndex}</span>
                </div>
            </div>
        </div>
    {/each}
</div>

<style>
    @import url("https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400&family=Nunito:wght@300;400;600&display=swap");

    .desktop-surface {
        width: 100%;
        height: 100%;
        background: radial-gradient(
                ellipse at 20% 50%,
                rgba(201, 191, 238, 0.3) 0%,
                transparent 60%
            ),
            radial-gradient(
                ellipse at 80% 20%,
                rgba(168, 221, 224, 0.25) 0%,
                transparent 55%
            ),
            radial-gradient(
                ellipse at 60% 80%,
                rgba(242, 212, 194, 0.2) 0%,
                transparent 50%
            ),
            #f0eafa;
        position: relative;
        overflow: hidden;
        font-family: "Nunito", sans-serif;
    }

    .spawn {
        position: absolute;
        top: 20px;
        left: 20px;
        background: rgba(255, 255, 255, 0.6);
        border: 1px solid rgba(201, 191, 238, 0.8);
        border-radius: 20px;
        padding: 8px 18px 8px 14px;
        font-family: "DM Mono", monospace;
        font-size: 12px;
        font-weight: 400;
        color: #5a4a7a;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 7px;
        backdrop-filter: blur(8px);
        transition: all 0.2s ease;
        z-index: 9999;
        letter-spacing: 0.04em;
    }

    .spawn:hover {
        background: rgba(255, 255, 255, 0.85);
        border-color: #c9bfee;
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(157, 143, 212, 0.25);
    }

    .spawn:active {
        transform: translateY(0);
    }

    .spawn-icon {
        font-size: 11px;
        color: #9d8fd4;
    }

    .window-card {
        position: absolute;
        border-radius: 12px;
        border: 1px solid;
        backdrop-filter: blur(12px);
        box-shadow:
            0 8px 32px rgba(100, 80, 160, 0.12),
            0 2px 8px rgba(100, 80, 160, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.6);
        animation: bloom 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        overflow: hidden;
    }

    @keyframes bloom {
        from {
            opacity: 0;
            transform: scale(0.88);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }

    .window-titlebar {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 10px 14px;
        border-bottom: 1px solid;
        background: rgba(255, 255, 255, 0.3);
    }

    .window-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        display: block;
        flex-shrink: 0;
    }

    .window-title {
        font-family: "DM Mono", monospace;
        font-size: 11px;
        color: #3d2e6b;
        letter-spacing: 0.08em;
        margin-left: 6px;
        opacity: 0.8;
    }

    .window-body {
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .window-meta {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
    }

    .meta-label {
        font-family: "DM Mono", monospace;
        font-size: 10px;
        letter-spacing: 0.1em;
        color: #8a7aaa;
        text-transform: uppercase;
    }

    .meta-value {
        font-family: "DM Mono", monospace;
        font-size: 12px;
        color: #3d2e6b;
        font-weight: 400;
    }
</style>
