<script lang="ts">
    import { windowManager } from "$lib/windowManager.svelte";
    import Window from "$lib/components/Window.svelte";
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
        <Window {win} />
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
</style>
