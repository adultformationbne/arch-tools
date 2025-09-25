<script>
  import { onMount, onDestroy } from 'svelte';
  import { EditorView } from '@codemirror/view';
  import { EditorState } from '@codemirror/state';
  import { html } from '@codemirror/lang-html';
  import { oneDark } from '@codemirror/theme-one-dark';
  import { basicSetup } from 'codemirror';

  let {
    value = $bindable(''),
    placeholder = 'Enter HTML here...',
    readOnly = false,
    theme = 'dark'
  } = $props();

  let editor;
  let editorElement;
  let isUpdatingFromProp = false;

  // Create editor on mount
  onMount(() => {
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isUpdatingFromProp) {
        value = update.state.doc.toString();
      }
    });

    const extensions = [
      basicSetup,
      html(),
      updateListener,
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '14px'
        },
        '.cm-editor': {
          height: '100%'
        },
        '.cm-scroller': {
          fontFamily: '"SF Mono", "Monaco", "Inconsolata", "Fira Code", "Fira Mono", "Droid Sans Mono", "Source Code Pro", monospace'
        }
      }),
      EditorView.lineWrapping
    ];

    if (theme === 'dark') {
      extensions.push(oneDark);
    }

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    const state = EditorState.create({
      doc: value,
      extensions
    });

    editor = new EditorView({
      state,
      parent: editorElement
    });
  });

  // Update editor when value prop changes
  $effect(() => {
    if (editor && value !== editor.state.doc.toString()) {
      isUpdatingFromProp = true;

      const transaction = editor.state.update({
        changes: {
          from: 0,
          to: editor.state.doc.length,
          insert: value
        }
      });

      editor.dispatch(transaction);
      isUpdatingFromProp = false;
    }
  });

  // Cleanup
  onDestroy(() => {
    if (editor) {
      editor.destroy();
    }
  });

  // Expose methods for external use
  export function focus() {
    if (editor) {
      editor.focus();
    }
  }

  export function getSelection() {
    if (editor) {
      const selection = editor.state.selection.main;
      return {
        from: selection.from,
        to: selection.to,
        text: editor.state.doc.sliceString(selection.from, selection.to)
      };
    }
    return null;
  }
</script>

<div bind:this={editorElement} class="h-full w-full"></div>