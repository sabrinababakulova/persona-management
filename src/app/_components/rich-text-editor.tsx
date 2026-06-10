"use client";

import Link from "@tiptap/extension-link";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";

import { AIGenerationIcon } from "~/app/_components/icons/AIGenerationIcon";
import { api } from "~/trpc/react";

/** The AI paraphrase button only appears once the editor has at least this many characters. */
const AI_PARAPHRASE_MIN_CHARS = 200;

type RichTextEditorProps = {
  className?: string;
  /** When true, the editor and toolbar are non-interactive (Tiptap is set to read-only). */
  disabled?: boolean;
  hideLabel?: boolean;
  id?: string;
  label: string;
  maxLength?: number;
  onChange: (html: string) => void;
  placeholder?: string;
  value: string;
};

const TOOLBAR_BUTTON_CLASS =
  "rounded-[4px] border border-border-input bg-bg-light px-2 py-1 font-medium text-[12px] text-text-secondary leading-none transition-colors hover:bg-bg-hover";
const TOOLBAR_ACTIVE_CLASS =
  "border-primary-blue bg-primary-blue-light text-primary-blue";

function ToolbarButton({
  active,
  disabled,
  label,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`${TOOLBAR_BUTTON_CLASS} ${active ? TOOLBAR_ACTIVE_CLASS : ""} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const promptForLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL ссылки", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url, target: "_blank", rel: "noopener noreferrer" })
      .run();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-border-input border-b bg-bg-input px-2 py-2">
      <ToolbarButton
        disabled={!editor.can().undo()}
        label="↶"
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolbarButton
        disabled={!editor.can().redo()}
        label="↷"
        onClick={() => editor.chain().focus().redo().run()}
      />
      <span className="mx-1 h-4 w-px bg-border-input" />
      <ToolbarButton
        active={editor.isActive("bold")}
        label="B"
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        active={editor.isActive("italic")}
        label="I"
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <span className="mx-1 h-4 w-px bg-border-input" />
      <ToolbarButton
        active={editor.isActive("heading", { level: 3 })}
        label="H3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />
      <ToolbarButton
        active={editor.isActive("heading", { level: 4 })}
        label="H4"
        onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
      />
      <ToolbarButton
        active={editor.isActive("paragraph")}
        label="¶"
        onClick={() => editor.chain().focus().setParagraph().run()}
      />
      <span className="mx-1 h-4 w-px bg-border-input" />
      <ToolbarButton
        active={editor.isActive("bulletList")}
        label="• Список"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        active={editor.isActive("orderedList")}
        label="1. Список"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <span className="mx-1 h-4 w-px bg-border-input" />
      <ToolbarButton
        active={editor.isActive("link")}
        label="Ссылка"
        onClick={promptForLink}
      />
      <ToolbarButton
        label="Очистить"
        onClick={() =>
          editor.chain().focus().unsetAllMarks().clearNodes().run()
        }
      />
    </div>
  );
}

function AiParaphraseFooter({
  disabled,
  editor,
  maxLength,
  onChange,
}: {
  disabled: boolean;
  editor: Editor;
  maxLength?: number;
  onChange: (html: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const paraphrase = api.ai.paraphrase.useMutation();

  const handleParaphrase = async () => {
    if (disabled || paraphrase.isPending || editor.isEmpty) return;
    setError(null);
    const originalHtml = editor.getHTML();
    // Lock typing while the AI is working so edits can't race the result.
    editor.setEditable(false);
    try {
      const { html } = await paraphrase.mutateAsync({ html: originalHtml });
      editor.commands.setContent(html, { emitUpdate: false });
      if (maxLength !== undefined && editor.getText().length > maxLength) {
        // Paraphrase exceeded the limit — restore the original text untouched.
        editor.commands.setContent(originalHtml, { emitUpdate: false });
        setError(
          `Перефразированный текст превышает лимит в ${maxLength} символов`,
        );
        return;
      }
      onChange(editor.isEmpty ? "" : editor.getHTML());
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Не удалось перефразировать текст",
      );
    } finally {
      editor.setEditable(!disabled);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-border-input border-t bg-bg-input px-2 py-2">
      <button
        className="inline-flex items-center gap-1.5 rounded-[4px] border border-border-input bg-bg-light px-2 py-1 font-medium text-[12px] text-accent-ai leading-none transition-colors hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled || paraphrase.isPending}
        onClick={handleParaphrase}
        type="button"
      >
        <AIGenerationIcon />
        {paraphrase.isPending ? "Перефразируем…" : "Перефразировать с AI"}
      </button>
      {error && <span className="text-[12px] text-danger-red">{error}</span>}
    </div>
  );
}

export function RichTextEditor({
  className,
  disabled = false,
  hideLabel = false,
  id,
  label,
  maxLength,
  onChange,
  placeholder,
  value,
}: RichTextEditorProps) {
  const editorId = id ?? label;

  const editor = useEditor({
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "tiptap min-h-[180px] w-full bg-bg-light px-3 py-3 text-[15px] text-text-heading leading-[1.5] focus:outline-none [&_h3]:font-bold [&_h3]:text-[18px] [&_h3]:my-2 [&_h4]:font-semibold [&_h4]:text-[16px] [&_h4]:my-2 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary-blue [&_a]:underline [&_strong]:font-semibold",
        id: editorId,
      },
    },
    extensions: [
      StarterKit.configure({
        heading: { levels: [3, 4] },
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
    ],
    immediatelyRender: false,
    onUpdate: ({ editor: instance }) => {
      const html = instance.isEmpty ? "" : instance.getHTML();
      if (maxLength !== undefined && instance.getText().length > maxLength) {
        return;
      }
      onChange(html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value === editor.getHTML()) return;
    if (value === "" && editor.isEmpty) return;
    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  const charCount = editor?.getText().length ?? 0;
  const isEmpty = editor?.isEmpty ?? true;

  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <label
        className={
          hideLabel
            ? "sr-only"
            : "w-full font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
        }
        htmlFor={editorId}
      >
        {label}
      </label>
      <div
        className={`overflow-hidden rounded-[6px] border border-border-input bg-bg-light focus-within:border-primary-blue ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
      >
        {editor && (
          <div
            aria-hidden={disabled || undefined}
            className={
              disabled ? "pointer-events-none select-none opacity-60" : ""
            }
          >
            <Toolbar editor={editor} />
          </div>
        )}
        <div className="relative">
          {isEmpty && placeholder && (
            <div className="pointer-events-none absolute top-3 left-3 text-[15px] text-text-placeholder">
              {placeholder}
            </div>
          )}
          <EditorContent editor={editor} />
        </div>
        {editor && charCount >= AI_PARAPHRASE_MIN_CHARS && (
          <AiParaphraseFooter
            disabled={disabled}
            editor={editor}
            maxLength={maxLength}
            onChange={onChange}
          />
        )}
      </div>
      {maxLength !== undefined && (
        <div className="flex justify-end text-[12px] text-text-placeholder">
          {charCount} / {maxLength}
        </div>
      )}
    </div>
  );
}
