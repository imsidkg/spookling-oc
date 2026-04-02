"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Search,
  RefreshCw,
  Save,
  Clock,
  Eye,
  Edit3,
  Loader2,
} from "lucide-react";
import { marked } from "marked";
import { formatDistanceToNow } from "date-fns";

interface MemoryFile {
  name: string;
  path: string;
  content: string;
  lastModified: string;
  size: number;
}

interface SearchResult {
  file: string;
  line: number;
  content: string;
  context: string;
}

export function MemoryStudio() {
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<MemoryFile | null>(null);
  const [editContent, setEditContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("preview");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/memory/read");
      const data = await res.json();
      if (data.files) {
        setFiles(data.files);
        if (!selectedFile && data.files.length > 0) {
          const autoSelect = data.files[0];
          if (autoSelect) {
            setSelectedFile(autoSelect);
            setEditContent(autoSelect.content);
          }
        }
      }
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Failed to load memory files:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedFile]);

  useEffect(() => {
    loadFiles();
    const interval = setInterval(loadFiles, 3000);
    return () => clearInterval(interval);
  }, [loadFiles]);

  const selectFile = (file: MemoryFile) => {
    setSelectedFile(file);
    setEditContent(file.content);
    setViewMode("preview");
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await fetch("/api/memory/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: selectedFile.name,
          content: editContent,
        }),
      });
      await loadFiles();
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  const searchMemory = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/memory/search?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  };

  const renderMarkdown = (content: string) => {
    const html = marked.parse(content, { async: false }) as string;
    return { __html: html };
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* File list sidebar */}
      <div className="w-72 border-r border-outline-variant/10 flex flex-col shrink-0 bg-surface-container-lowest">
        {/* Search */}
        <div className="p-4 border-b border-outline-variant/10">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchMemory()}
              placeholder="Search memory..."
              className="flex-1 bg-surface-container border-0 border-l-2 border-outline-variant/20 py-2 pl-3 text-sm focus:ring-0 focus:border-primary placeholder:text-on-surface/20"
            />
            <button
              onClick={searchMemory}
              disabled={searching}
              className="p-2 text-primary hover:bg-primary/10 transition-colors"
            >
              {searching ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Search size={16} />
              )}
            </button>
          </div>
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="border-b border-outline-variant/10 max-h-48 overflow-y-auto">
            <div className="px-4 py-2 text-[0.65rem] font-black uppercase tracking-[0.2em] text-primary bg-surface-container">
              Results ({searchResults.length})
            </div>
            {searchResults.map((result, i) => (
              <div
                key={i}
                className="px-4 py-3 border-b border-outline-variant/5 hover:bg-surface-container cursor-pointer transition-colors"
              >
                <p className="text-xs font-bold text-primary">
                  {result.file}:{result.line}
                </p>
                <p className="text-xs text-on-surface/40 mt-0.5 line-clamp-2">
                  {result.context}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Files */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/10">
            <span className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-on-surface/40">
              Workspace Files
            </span>
            <button
              onClick={loadFiles}
              className="text-on-surface/40 hover:text-primary transition-colors"
            >
              <RefreshCw size={12} />
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2
                size={20}
                className="animate-spin text-on-surface/40"
              />
            </div>
          ) : files.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-on-surface/40">No memory files.</p>
              <p className="text-xs text-on-surface/20 mt-1">
                Start OpenClaw to generate workspace files.
              </p>
            </div>
          ) : (
            files.map((file) => (
              <button
                key={file.name}
                onClick={() => selectFile(file)}
                className={`w-full text-left px-4 py-3 border-b border-outline-variant/5 transition-colors ${
                  selectedFile?.name === file.name
                    ? "bg-surface-container border-l-2 border-l-primary text-primary"
                    : "hover:bg-surface-container-high/40 text-on-surface"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-primary shrink-0" />
                  <span className="text-sm font-bold truncate">
                    {file.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-on-surface/30 ml-5">
                  <Clock size={10} />
                  {formatDistanceToNow(new Date(file.lastModified), {
                    addSuffix: true,
                  })}
                  <span className="ml-1">
                    ({(file.size / 1024).toFixed(1)}KB)
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="p-3 border-t border-outline-variant/10 text-[10px] text-on-surface/20 text-center">
          Refresh: {lastRefresh.toLocaleTimeString()}
        </div>
      </div>

      {/* Editor / Preview */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedFile ? (
          <>
            <div className="flex items-center justify-between px-6 py-3 border-b border-outline-variant/10 bg-surface-container-lowest">
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-primary" />
                <span className="text-sm font-bold">{selectedFile.name}</span>
                <span className="text-xs text-on-surface/30">
                  {formatDistanceToNow(new Date(selectedFile.lastModified), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setViewMode(viewMode === "edit" ? "preview" : "edit")
                  }
                  className="flex items-center gap-1.5 px-4 py-1.5 border border-outline-variant/20 text-xs font-bold uppercase tracking-wide hover:border-primary/50 hover:text-primary transition-colors"
                >
                  {viewMode === "edit" ? (
                    <>
                      <Eye size={12} /> Preview
                    </>
                  ) : (
                    <>
                      <Edit3 size={12} /> Edit
                    </>
                  )}
                </button>
                {viewMode === "edit" && (
                  <button
                    onClick={saveFile}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-on-primary text-xs font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    {saving ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Save size={12} />
                    )}
                    Save
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {viewMode === "edit" ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-full p-6 bg-transparent text-sm font-mono resize-none focus:outline-none border-0 focus:ring-0"
                  spellCheck={false}
                />
              ) : (
                <div
                  className="p-8 markdown-body text-sm"
                  dangerouslySetInnerHTML={renderMarkdown(selectedFile.content)}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-on-surface/30">
            <div className="text-center">
              <FileText size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm font-bold uppercase tracking-widest">
                Select a file
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
