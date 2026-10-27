<script lang="ts">
  import '$lib/style/tokens.css';
  import './mycelium.css';
  let { children } = $props();
</script>

<div class="mycelium-root">{@render children()}</div>
