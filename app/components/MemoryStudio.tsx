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
        // Auto-select MEMORY.md if nothing selected
        if (!selectedFile && data.files.length > 0) {
          // Auto-select first priority file (SOUL.md, IDENTITY.md, etc.)
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
    // Poll for changes (simulating chokidar on client side)
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
    <div className="flex h-full">
      {/* File list sidebar */}
      <div className="w-72 border-r border-border flex flex-col shrink-0">
        {/* Search */}
        <div className="p-3 border-b border-border">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchMemory()}
              placeholder="Search memory..."
              className="flex-1 bg-card border border-border rounded-lg px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              onClick={searchMemory}
              disabled={searching}
              className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
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
          <div className="border-b border-border max-h-48 overflow-y-auto">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-secondary/50">
              Search Results ({searchResults.length})
            </div>
            {searchResults.map((result, i) => (
              <div
                key={i}
                className="px-3 py-2 border-b border-border/50 hover:bg-secondary/50 cursor-pointer"
              >
                <p className="text-xs font-medium text-primary">
                  {result.file}:{result.line}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {result.context}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Files */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
            <span className="text-xs font-medium text-muted-foreground">
              Workspace Files
            </span>
            <button
              onClick={loadFiles}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw size={12} />
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : files.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <p>No memory files found.</p>
              <p className="mt-1 text-xs">
                Start OpenClaw to generate workspace files.
              </p>
            </div>
          ) : (
            files.map((file) => (
              <button
                key={file.name}
                onClick={() => selectFile(file)}
                className={`w-full text-left px-3 py-2.5 border-b border-border/30 transition-colors ${
                  selectedFile?.name === file.name
                    ? "bg-primary/5 border-l-2 border-l-primary"
                    : "hover:bg-secondary/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-primary shrink-0" />
                  <span className="text-sm font-medium truncate">
                    {file.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground ml-5">
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

        <div className="p-2 border-t border-border text-[10px] text-muted-foreground text-center">
          Last refresh: {lastRefresh.toLocaleTimeString()}
        </div>
      </div>

      {/* Editor / Preview */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedFile ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                <span className="text-sm font-medium">{selectedFile.name}</span>
                <span className="text-xs text-muted-foreground">
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
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-secondary hover:bg-secondary/80 transition-colors"
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
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
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
            <div className="flex-1 overflow-y-auto">
              {viewMode === "edit" ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-full p-4 bg-transparent text-sm font-mono resize-none focus:outline-none"
                  spellCheck={false}
                />
              ) : (
                <div
                  className="p-6 markdown-body text-sm"
                  dangerouslySetInnerHTML={renderMarkdown(
                    selectedFile.content
                  )}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Brain size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-sm">Select a memory file to view</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Brain(props: React.SVGProps<SVGSVGElement> & { size?: number }) {
  const { size = 24, ...rest } = props;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  );
}
