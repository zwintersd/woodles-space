<script lang="ts">
  type Channel = { id: string; label: string; value: string };
  let { title, items, type = 'text', onchange }: {
    title: string; items: Channel[]; type?: 'email' | 'tel' | 'url' | 'text'; onchange: (items: Channel[]) => void;
  } = $props();
  function change(id: string, patch: Partial<Channel>) {
    onchange(items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }
</script>

<fieldset class="channels">
  <legend>{title}</legend>
  {#each items as item, index (item.id)}
    <div class="channel-row">
      <input class="channel-label" maxlength="100" aria-label={`${title} ${index + 1} label`} placeholder="label" value={item.label} oninput={(e) => change(item.id, { label: e.currentTarget.value })} />
      <input {type} maxlength="2000" aria-label={`${title} ${index + 1}`} placeholder={title === 'Email' ? 'hello@example.com' : title === 'Phone' ? '+1…' : 'https://…'} value={item.value} oninput={(e) => change(item.id, { value: e.currentTarget.value })} />
      <button type="button" class="icon-button" aria-label={`Remove ${title.toLowerCase()} ${index + 1}`} onclick={() => onchange(items.filter((entry) => entry.id !== item.id))}>×</button>
    </div>
  {/each}
  <button type="button" class="text-button" disabled={items.length >= 100} onclick={() => onchange([...items, { id: crypto.randomUUID(), label: '', value: '' }])}>＋ add {title.toLowerCase()}</button>
</fieldset>
