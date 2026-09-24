import { useState, useCallback } from "react";
import { Link } from "wouter";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/components/theme-provider";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Code2,
  File,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Play,
  Save,
  Settings,
  Terminal,
  X,
} from "lucide-react";

interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  content?: string;
  language?: string;
}

const initialFileTree: FileNode[] = [
  {
    name: "src",
    type: "folder",
    children: [
      {
        name: "index.ts",
        type: "file",
        language: "typescript",
        content: `// Team Phoenix - EduLearn Platform
// Main entry point

import { createServer } from './server';
import { initDatabase } from './db';

async function main() {
  console.log('Starting EduLearn Platform...');
  
  // Initialize database
  await initDatabase();
  
  // Create and start server
  const server = await createServer();
  
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(\`Server running on port \${PORT}\`);
  });
}

main().catch(console.error);
`,
      },
      {
        name: "server.ts",
        type: "file",
        language: "typescript",
        content: `import express from 'express';
import cors from 'cors';
import { routes } from './routes';

export async function createServer() {
  const app = express();
  
  app.use(cors());
  app.use(express.json());
  
  // Register routes
  app.use('/api', routes);
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
  });
  
  return app;
}
`,
      },
      {
        name: "db.ts",
        type: "file",
        language: "typescript",
        content: `// Database configuration
import { Pool } from 'pg';

let pool: Pool;

export async function initDatabase() {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  // Test connection
  const client = await pool.connect();
  console.log('Database connected successfully');
  client.release();
}

export { pool };
`,
      },
    ],
  },
  {
    name: "package.json",
    type: "file",
    language: "json",
    content: `{
  "name": "edulearn-platform",
  "version": "1.0.0",
  "description": "Team Phoenix - EduLearn Platform",
  "main": "dist/index.tsx",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.tsx"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "typescript": "^5.3.2",
    "tsx": "^4.6.0",
    "@types/express": "^4.17.21",
    "@types/pg": "^8.10.9"
  }
}
`,
  },
  {
    name: "README.md",
    type: "file",
    language: "markdown",
    content: `# EduLearn Platform

## Team Phoenix

### Problem Statement
Build an accessible online learning platform for underserved communities.

### Tech Stack
- Node.js / TypeScript
- PostgreSQL
- React (Frontend - separate repo)

### Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

### Team Members
- Ananya Singh (Promoter)
- Rahul Kumar (Co-Promoter)
- Priya Sharma (Member)
`,
  },
];

interface OpenTab {
  name: string;
  path: string;
  language: string;
  content: string;
}

function FileIcon({ name, type }: { name: string; type: "file" | "folder" }) {
  if (type === "folder") {
    return <Folder className="h-4 w-4 text-[#D4A574]" />;
  }

  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return <FileCode className="h-4 w-4 text-blue-500" />;
    case "js":
    case "jsx":
      return <FileCode className="h-4 w-4 text-[#D4A574]" />;
    case "json":
      return <FileJson className="h-4 w-4 text-green-500" />;
    case "md":
      return <FileText className="h-4 w-4 text-gray-400" />;
    default:
      return <File className="h-4 w-4 text-gray-400" />;
  }
}

function FileTree({
  nodes,
  level = 0,
  parentPath = "",
  onFileSelect,
  selectedPath,
}: {
  nodes: FileNode[];
  level?: number;
  parentPath?: string;
  onFileSelect: (file: FileNode, path: string) => void;
  selectedPath: string;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    src: true,
  });

  return (
    <div className="text-sm">
      {nodes.map((node) => {
        const path = parentPath ? `${parentPath}/${node.name}` : node.name;
        const isExpanded = expanded[path];
        const isSelected = selectedPath === path;

        return (
          <div key={path}>
            <div
              className={`flex items-center gap-1 py-1 px-2 cursor-pointer rounded hover-elevate ${
                isSelected ? "bg-accent" : ""
              }`}
              style={{ paddingLeft: `${level * 12 + 8}px` }}
              onClick={() => {
                if (node.type === "folder") {
                  setExpanded((prev) => ({ ...prev, [path]: !isExpanded }));
                } else {
                  onFileSelect(node, path);
                }
              }}
            >
              {node.type === "folder" ? (
                isExpanded ? (
                  <ChevronDown className="h-3 w-3 shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0" />
                )
              ) : (
                <span className="w-3" />
              )}
              {node.type === "folder" && isExpanded ? (
                <FolderOpen className="h-4 w-4 text-[#D4A574] shrink-0" />
              ) : (
                <FileIcon name={node.name} type={node.type} />
              )}
              <span className="truncate">{node.name}</span>
            </div>
            {node.type === "folder" && isExpanded && node.children && (
              <FileTree
                nodes={node.children}
                level={level + 1}
                parentPath={path}
                onFileSelect={onFileSelect}
                selectedPath={selectedPath}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function StudioPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    "$ npm run dev",
    "[nodemon] starting `tsx src/index.ts`",
    "Starting EduLearn Platform...",
    "Database connected successfully",
    "Server running on port 3000",
    "",
  ]);
  const [selectedPath, setSelectedPath] = useState("");

  const handleFileSelect = useCallback((file: FileNode, path: string) => {
    setSelectedPath(path);

    // Check if tab already open
    const existingTab = openTabs.find((t) => t.path === path);
    if (existingTab) {
      setActiveTab(path);
      return;
    }

    // Open new tab
    const newTab: OpenTab = {
      name: file.name,
      path,
      language: file.language || "plaintext",
      content: file.content || "",
    };
    setOpenTabs((prev) => [...prev, newTab]);
    setActiveTab(path);
  }, [openTabs]);

  const handleCloseTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenTabs((prev) => prev.filter((t) => t.path !== path));
    if (activeTab === path) {
      const remaining = openTabs.filter((t) => t.path !== path);
      setActiveTab(remaining.length > 0 ? remaining[remaining.length - 1].path : null);
    }
  };

  const handleEditorChange = (value: string | undefined, path: string) => {
    if (value !== undefined) {
      setOpenTabs((prev) =>
        prev.map((t) => (t.path === path ? { ...t, content: value } : t))
      );
    }
  };

  const activeFile = openTabs.find((t) => t.path === activeTab);

  const monacoTheme = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ? "vs-dark"
    : "light";

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between h-12 px-4 border-b bg-muted/30">
        <div className="flex items-center gap-4">
          <Link href="/app">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            <span className="font-semibold">Studio</span>
          </div>
          <Badge variant="outline" className="hidden sm:flex">
            Team Phoenix
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-2" data-testid="button-save">
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">Save</span>
          </Button>
          <Button size="sm" className="gap-2" data-testid="button-run">
            <Play className="h-4 w-4" />
            <span className="hidden sm:inline">Run</span>
          </Button>
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* File Explorer */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
            <div className="h-full flex flex-col border-r">
              <div className="p-2 border-b">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Explorer
                </span>
              </div>
              <div className="flex-1 overflow-auto py-2">
                <FileTree
                  nodes={initialFileTree}
                  onFileSelect={handleFileSelect}
                  selectedPath={selectedPath}
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Editor Area */}
          <ResizablePanel defaultSize={80}>
            <ResizablePanelGroup direction="vertical">
              {/* Code Editor */}
              <ResizablePanel defaultSize={70}>
                <div className="h-full flex flex-col">
                  {/* Tabs */}
                  {openTabs.length > 0 && (
                    <div className="flex items-center border-b bg-muted/30 overflow-x-auto">
                      {openTabs.map((tab) => (
                        <div
                          key={tab.path}
                          className={`flex items-center gap-2 px-3 py-2 border-r cursor-pointer text-sm ${
                            activeTab === tab.path
                              ? "bg-background"
                              : "hover-elevate"
                          }`}
                          onClick={() => setActiveTab(tab.path)}
                        >
                          <FileIcon name={tab.name} type="file" />
                          <span className="whitespace-nowrap">{tab.name}</span>
                          <button
                            className="ml-1 p-0.5 rounded hover:bg-muted"
                            onClick={(e) => handleCloseTab(tab.path, e)}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Editor */}
                  <div className="flex-1">
                    {activeFile ? (
                      <Editor
                        height="100%"
                        language={activeFile.language}
                        value={activeFile.content}
                        theme={monacoTheme}
                        onChange={(value) => handleEditorChange(value, activeFile.path)}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                          lineNumbers: "on",
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          tabSize: 2,
                          wordWrap: "on",
                        }}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <Code2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                          <p>Select a file to start editing</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Terminal */}
              <ResizablePanel defaultSize={30}>
                <div className="h-full flex flex-col border-t">
                  <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                    <Tabs defaultValue="terminal">
                      <TabsList className="h-7">
                        <TabsTrigger value="terminal" className="text-xs gap-1 h-6">
                          <Terminal className="h-3 w-3" />
                          Terminal
                        </TabsTrigger>
                        <TabsTrigger value="output" className="text-xs h-6">
                          Output
                        </TabsTrigger>
                        <TabsTrigger value="problems" className="text-xs h-6">
                          Problems
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  <div className="flex-1 overflow-auto p-3 font-mono text-sm bg-[#1e1e1e] dark:bg-[#0d0d0d]">
                    {terminalOutput.map((line, i) => (
                      <div key={i} className="text-gray-300">
                        {line}
                      </div>
                    ))}
                    <div className="flex items-center text-gray-300">
                      <span className="text-green-400">$</span>
                      <span className="ml-2 animate-pulse">_</span>
                    </div>
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
