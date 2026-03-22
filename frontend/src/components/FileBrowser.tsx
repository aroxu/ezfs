import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Link,
  Breadcrumbs,
  BreadcrumbItem,
  Button,
  Card,
  CardBody,
  Chip,
  Tooltip,
} from "@heroui/react";
import { Folder, File, Download, Eye, ChevronRight } from "lucide-react";
import { fetchPublicFiles } from "../utils/api";
import type { FileItem } from "../utils/api";
import PreviewModal from "./PreviewModal";
import { useDisclosure } from "@heroui/react";
import JSZip from "jszip";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";

const FileBrowser = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname === "/" ? "" : location.pathname.replace(/^\//, "");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [zipStatus, setZipStatus] = useState<{ active: boolean; progress: number; fileName: string }>({
    active: false,
    progress: 0,
    fileName: "",
  });
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  useEffect(() => {
    document.title = path ? `ezfs - ${path}` : "ezfs - Public";
  }, [path]);

  const loadFiles = async (currentPath: string) => {
    setLoading(true);
    try {
      const res = await fetchPublicFiles(currentPath);
      setFiles(res.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = (file: FileItem) => {
    setSelectedFile(file);
    onOpen();
  };

  const downloadFolder = async (folder: FileItem) => {
    const zip = new JSZip();
    setZipStatus({ active: true, progress: 0, fileName: folder.name });

    const addFolderToZip = async (currentPath: string, zipFolder: JSZip) => {
      const res = await fetchPublicFiles(currentPath);
      const items: FileItem[] = res.data || [];

      for (const item of items) {
        if (item.is_dir) {
          const newZipFolder = zipFolder.folder(item.name);
          if (newZipFolder) {
            await addFolderToZip(item.path, newZipFolder);
          }
        } else {
          const fileRes = await fetch(`/${item.path}`);
          const blob = await fileRes.blob();
          zipFolder.file(item.name, blob);
        }
      }
    };

    try {
      setLoading(true);
      const rootZip = zip.folder(folder.name);
      if (rootZip) {
        await addFolderToZip(folder.path, rootZip);
        const content = await zip.generateAsync({ type: "blob" }, (metadata) => {
          setZipStatus((prev) => ({ ...prev, progress: Math.round(metadata.percent) }));
        });
        const url = window.URL.createObjectURL(content);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${folder.name}.zip`;
        link.click();
      }
    } catch (err) {
      console.error("ZIP Error:", err);
    } finally {
      setLoading(false);
      setZipStatus({ active: false, progress: 0, fileName: "" });
    }
  };

  useEffect(() => {
    loadFiles(path);
  }, [path]);

  const handleNavigate = useCallback((newPath: string) => {
    navigate(newPath ? `/${newPath}` : "/");
  }, [navigate]);

  const breadcrumbs = path.split("/").filter(Boolean);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="flex flex-col gap-6">
      <PreviewModal isOpen={isOpen} onOpenChange={onOpenChange} file={selectedFile} />

      <Card className="bg-background/60 border border-divider shadow-sm overflow-hidden" isBlurred>
        <CardBody className="py-3 px-5 overflow-x-auto">
          <Breadcrumbs
            maxItems={4}
            itemsBeforeCollapse={1}
            itemsAfterCollapse={2}
            separator={<ChevronRight size={14} />}
            itemClasses={{
              item: "text-small font-medium data-[current=true]:text-primary whitespace-nowrap",
              separator: "text-default-400",
            }}
          >
            <BreadcrumbItem onClick={() => handleNavigate("")}>Root</BreadcrumbItem>
            {breadcrumbs.map((crumb, i) => (
              <BreadcrumbItem key={i} onClick={() => handleNavigate(breadcrumbs.slice(0, i + 1).join("/"))}>
                {crumb}
              </BreadcrumbItem>
            ))}
          </Breadcrumbs>
        </CardBody>
      </Card>

      <Table
        aria-label="File list"
        removeWrapper
        className="bg-background/40 w-full"
        classNames={{
          table: "table-fixed w-full",
          th: "bg-transparent text-default-500 border-b border-divider",
          tr: "hover:bg-default-100/50 transition-colors group",
          td: "py-4",
        }}
      >
        <TableHeader>
          <TableColumn>NAME</TableColumn>
          <TableColumn width={150} className="hidden sm:table-cell">SIZE</TableColumn>
          <TableColumn align="end" width={100}>
            ACTIONS
          </TableColumn>
        </TableHeader>
        <TableBody emptyContent={"No files found"} isLoading={loading}>
          {(files || []).map((file) => (
            <TableRow key={file.path}>
              <TableCell>
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div
                    className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${file.is_dir ? "bg-primary/10 text-primary" : "bg-default-100 text-default-600"}`}
                  >
                    {file.is_dir ? <Folder size={18} className="sm:w-5 sm:h-5" /> : <File size={18} className="sm:w-5 sm:h-5" />}
                  </div>
                  <div className="min-w-0">
                    {file.is_dir ? (
                      <Link
                        className="cursor-pointer font-medium text-foreground hover:text-primary transition-colors text-sm sm:text-base truncate block"
                        onClick={() => handleNavigate(file.path)}
                      >
                        {file.name}
                      </Link>
                    ) : file.name.match(/\.html?$/) ? (
                      <a
                        href={`/${file.path}`}
                        className="font-medium text-foreground hover:text-primary transition-colors cursor-pointer text-sm sm:text-base truncate block"
                      >
                        {file.name}
                      </a>
                    ) : (
                      <a
                        href={`/${file.path}`}
                        download
                        className="font-medium text-foreground hover:text-primary transition-colors cursor-pointer text-sm sm:text-base truncate block"
                      >
                        {file.name}
                      </a>
                    )}
                    <div className="sm:hidden text-tiny text-default-400 truncate">
                      {file.is_dir ? "Folder" : formatSize(file.size)}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {file.is_dir ? (
                  <Chip size="sm" variant="flat">
                    Folder
                  </Chip>
                ) : (
                  <span className="text-default-500 text-small">{formatSize(file.size)}</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  {file.is_dir ? (
                    <Tooltip content="Download Folder (Zip)">
                      <Button isIconOnly size="sm" variant="flat" color="primary" onClick={() => downloadFolder(file)}>
                        <Download size={18} />
                      </Button>
                    </Tooltip>
                  ) : (
                    <>
                      <Tooltip content="Preview">
                        <Button isIconOnly size="sm" variant="flat" onPress={() => handlePreview(file)}>
                          <Eye size={18} />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Download">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          as="a"
                          href={`/${file.path}`}
                          download
                        >
                          <Download size={18} />
                        </Button>
                      </Tooltip>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AnimatePresence>
        {zipStatus.active && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 right-0 left-0 md:left-auto md:bottom-8 md:right-8 z-50 p-4 md:p-0"
          >
            <Card
              className="w-full md:w-80 bg-background/80 backdrop-blur-xl border border-divider shadow-2xl"
              isBlurred
            >
              <CardBody className="p-4 flex flex-row items-center gap-4">
                <div className="relative flex items-center justify-center">
                  <Loader2 className="animate-spin text-primary" size={28} />
                  <span className="absolute text-[10px] font-bold text-primary">{zipStatus.progress}%</span>
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-small font-bold truncate">Zipping Folder...</span>
                  <span className="text-tiny text-default-500 truncate">{zipStatus.fileName}</span>
                </div>
              </CardBody>
              <div className="h-1 bg-primary transition-all duration-300" style={{ width: `${zipStatus.progress}%` }} />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileBrowser;
