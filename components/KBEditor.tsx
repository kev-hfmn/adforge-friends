"use client";

import { useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { updateKBSection, updateKBTitle, deleteKBSection } from "@/app/projects/[id]/kb/actions";
import { ChevronDown, ChevronRight, Save, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

interface KBSection {
  id: string;
  projectId: string | null;
  section: string | null;
  title: string;
  content: string | null;
  sortOrder: number | null;
  updatedAt: number | null;
}

export function KBEditor({ section }: { section: KBSection }) {
  const [collapsed, setCollapsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(section.title);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Write your content here..." }),
    ],
    content: section.content || "",
    editorProps: {
      attributes: {
        class: "prose prose-invert prose-sm max-w-none min-h-[120px] focus:outline-none px-4 py-3",
      },
    },
  });

  const handleSave = useCallback(async () => {
    if (!editor) return;
    setSaving(true);
    try {
      const content = editor.getHTML();
      await updateKBSection(section.id, content);
      if (title !== section.title) {
        await updateKBTitle(section.id, title);
      }
      toast.success("Section saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [editor, section.id, section.title, title]);

  const handleDelete = useCallback(async () => {
    if (!confirm("Delete this section?")) return;
    await deleteKBSection(section.id, section.projectId!);
    toast.success("Section deleted");
  }, [section.id, section.projectId]);

  return (
    <Card>
      <CardHeader className="cursor-pointer flex flex-row items-center gap-3 py-3 px-4" onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="h-8 text-sm font-medium bg-transparent border-none shadow-none focus-visible:ring-1 max-w-xs"
        />
        <Badge variant="secondary" className="text-xs">{section.section}</Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleSave(); }} disabled={saving}>
            {saving ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          </Button>
          {section.section === "custom" && (
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(); }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent className="pt-0 px-0">
          <div className="border-t border-border">
            <EditorContent editor={editor} />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
