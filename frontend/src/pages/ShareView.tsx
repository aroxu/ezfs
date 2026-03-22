import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Spinner,
  Divider,
  Alert,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Breadcrumbs,
  BreadcrumbItem,
  Tooltip,
  Chip,
  useDisclosure,
} from "@heroui/react";
import {
  Download,
  Eye,
  File as FileIcon,
  Lock,
  ShieldCheck,
  AlertCircle,
  Folder,
  ChevronRight,
  Loader2,
} from "lucide-react";
import axios, { AxiosError } from "axios";
import JSZip from "jszip";
import { motion, AnimatePresence } from "framer-motion";
import PreviewModal from "../components/PreviewModal";

interface ShareInfo {
  id: string;
  fileName: string;
  isFolder: boolean;
  hasPassword: boolean;
  expiresAt: number;
  maxAccess: number;
  accessCount: number;
}

interface ShareFileItem {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
}

const ShareView = () => {
  const { id } = useParams();
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [password, setPassword] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const basePath = `/s/${id}`;
  const currentPath = location.pathname.startsWith(basePath + "/")
    ? location.pathname.slice(basePath.length + 1)
    : "";
  const setCurrentPath = (newPath: string) => navigate(newPath ? `${basePath}/${newPath}` : basePath);
  const [contents, setContents] = useState<ShareFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewFile, setPreviewFile] = useState<ShareFileItem | null>(null);
  const { isOpen: isPreviewOpen, onOpen: onPreviewOpen, onOpenChange: onPreviewOpenChange } = useDisclosure();
  const [zipStatus, setZipStatus] = useState<{ active: boolean; progress: number; fileName: string }>({
    active: false,
    progress: 0,
    fileName: "",
  });

  const fetchInfo = useCallback(async () => {
    try {
      const res = await axios.get(`/api/shares/${id}`);
      setInfo(res.data);
      if (!res.data.hasPassword) {
        setIsAuthorized(true);
      }
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: string }>;
      setError(axiosErr.response?.data?.error || "Share not found or expired");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  useEffect(() => {
    if (info) {
      const displayPath = currentPath ? `/${currentPath}` : "";
      document.title = `ezfs - ${info.fileName}${displayPath}`;
    } else {
      document.title = "ezfs - Share";
    }
  }, [info, currentPath]);

  const fetchContents = useCallback(
    async (path: string = "") => {
      setListLoading(true);
      try {
        const res = await axios.get(`/api/shares/${id}/list?p=${encodeURIComponent(password)}&path=${path}`);
        setContents(res.data);
      } catch (err) {
        const axiosErr = err as AxiosError<{ error?: string }>;
        setError(axiosErr.response?.data?.error || "Failed to list contents");
      } finally {
        setListLoading(false);
      }
    },
    [id, password],
  );

  useEffect(() => {
    if (isAuthorized && info?.isFolder) {
      fetchContents(currentPath);
    }
  }, [isAuthorized, info, currentPath, fetchContents]);

  const handleAccess = async () => {
    try {
      await axios.post(`/api/shares/${id}/access`, { password });
      setIsAuthorized(true);
      setError("");
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: string }>;
      setError(axiosErr.response?.data?.error || "Access denied");
    }
  };

  const handleDownload = (subPath: string = "") => {
    const filename = subPath ? subPath.split("/").pop() : info?.fileName;
    const downloadUrl = `/api/shares/${id}/download?p=${encodeURIComponent(password)}&path=${encodeURIComponent(subPath)}`;

    const link = document.createElement("a");
    link.href = downloadUrl;
    if (filename) {
      link.download = filename;
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleZipDownload = async () => {
    if (!info) return;
    const zip = new JSZip();
    setZipStatus({ active: true, progress: 0, fileName: info.fileName });

    const addFolderToZip = async (path: string, zipFolder: JSZip) => {
      const res = await axios.get(`/api/shares/${id}/list?p=${encodeURIComponent(password)}&path=${path}`);
      const items: ShareFileItem[] = res.data;

      for (const item of items) {
        if (item.isDir) {
          const newZipFolder = zipFolder.folder(item.name);
          if (newZipFolder) await addFolderToZip(item.path, newZipFolder);
        } else {
          // Send custom header to indicate this is part of a compression process
          const fileRes = await fetch(
            `/api/shares/${id}/download?p=${encodeURIComponent(password)}&path=${encodeURIComponent(item.path)}`,
            {
              headers: {
                "X-Browser-Compressing": "true",
              },
            },
          );
          const blob = await fileRes.blob();
          zipFolder.file(item.name, blob);
        }
      }
    };

    try {
      const rootZip = zip.folder(info.fileName);
      if (rootZip) {
        // Increment access count exactly ONCE for the entire folder zip operation
        // No header here means it will be counted
        await axios.get(`/api/shares/${id}/download?p=${encodeURIComponent(password)}&path=`);

        await addFolderToZip("", rootZip);
        const content = await zip.generateAsync({ type: "blob" }, (metadata) => {
          setZipStatus((prev) => ({ ...prev, progress: Math.round(metadata.percent) }));
        });
        const url = window.URL.createObjectURL(content);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${info.fileName}.zip`;
        link.click();
      }
    } catch (err) {
      console.error("ZIP Error:", err);
    } finally {
      setZipStatus({ active: false, progress: 0, fileName: "" });
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Spinner size="lg" label="Loading private share..." color="primary" labelColor="primary" />
      </div>
    );

  if (error && !isAuthorized)
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Alert
          color="danger"
          title="Access Error"
          description={error}
          variant="flat"
          className="max-w-md shadow-lg"
          startContent={<AlertCircle size={24} />}
        />
      </div>
    );

  if (!isAuthorized) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Card className="w-full max-w-105 bg-background/60 border border-divider shadow-2xl" isBlurred>
          <CardHeader className="flex flex-col gap-1 p-6 items-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-4 shadow-inner">
              <Lock size={32} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-center">Password Required</h2>
            <p className="text-default-500 text-small text-center">
              This share is protected. Please enter the password.
            </p>
          </CardHeader>
          <Divider className="opacity-50" />
          <CardBody className="gap-6 p-8">
            <Input
              label="Password"
              placeholder="Enter access password"
              type="password"
              variant="bordered"
              labelPlacement="outside"
              startContent={<Lock size={18} className="text-default-400" />}
              value={password}
              onKeyDown={(e) => e.key === "Enter" && handleAccess()}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              color="primary"
              size="lg"
              fullWidth
              className="font-bold shadow-lg shadow-primary/20"
              onPress={handleAccess}
            >
              Access Share
            </Button>
            {error && <p className="text-danger text-center text-small">{error}</p>}
          </CardBody>
        </Card>
      </div>
    );
  }

  const breadcrumbs = currentPath ? currentPath.split("/") : [];

  return (
    <div className="max-w-300 mx-auto p-6 md:p-12 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{info?.fileName}</h1>
            <div className="flex items-center gap-3 mt-1 text-default-500 text-small">
              <Chip size="sm" variant="flat" color="primary">
                Private Share
              </Chip>
              {info && info.expiresAt > 0 && <span>Expires: {new Date(info.expiresAt).toLocaleString()}</span>}
              {info?.maxAccess && info.maxAccess > 0 && (
                <span>
                  Usage: {info.accessCount} / {info.maxAccess}
                </span>
              )}
            </div>
          </div>
        </div>
        {info?.isFolder && (
          <Button
            color="primary"
            variant="shadow"
            size="lg"
            className="font-bold h-14 px-8"
            startContent={<Download size={22} />}
            onPress={handleZipDownload}
          >
            Download Folder (ZIP)
          </Button>
        )}
      </div>

      {!info?.isFolder ? (
        <Card className="max-w-125 mx-auto bg-background/60 border border-divider shadow-2xl" isBlurred>
          <CardBody className="p-12 flex flex-col items-center gap-8">
            <div className="p-10 bg-default-100/50 rounded-full border border-divider shadow-inner">
              <FileIcon size={64} className="text-default-500" />
            </div>
            <div className="text-center gap-2 flex flex-col">
              <p className="text-xl font-bold">Ready to Download</p>
              <p className="text-default-500 text-small">This file is shared with you through our private channel.</p>
            </div>
            <Button
              color="primary"
              size="lg"
              fullWidth
              className="font-bold h-16 text-lg shadow-xl shadow-primary/20"
              startContent={<Download size={24} />}
              onPress={() => handleDownload()}
            >
              Download File
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <Card className="bg-background/60 border border-divider shadow-sm" isBlurred>
            <CardBody className="py-3 px-5">
              <Breadcrumbs
                separator={<ChevronRight size={14} />}
                itemClasses={{
                  item: "text-small font-medium data-[current=true]:text-primary",
                  separator: "text-default-400",
                }}
              >
                <BreadcrumbItem onClick={() => setCurrentPath("")}>{info.fileName}</BreadcrumbItem>
                {breadcrumbs.map((crumb, i) => (
                  <BreadcrumbItem key={i} onClick={() => setCurrentPath(breadcrumbs.slice(0, i + 1).join("/"))}>
                    {crumb}
                  </BreadcrumbItem>
                ))}
              </Breadcrumbs>
            </CardBody>
          </Card>

          <div className="bg-background/40 border border-divider rounded-2xl overflow-hidden backdrop-blur-md">
            <Table
              aria-label="Shared files"
              removeWrapper
              classNames={{
                th: "bg-default-100/50 text-default-500 border-b border-divider h-14",
                tr: "hover:bg-default-100/30 transition-colors group border-b border-divider last:border-0",
                td: "py-4",
              }}
            >
              <TableHeader>
                <TableColumn>NAME</TableColumn>
                <TableColumn width={150}>SIZE</TableColumn>
                <TableColumn align="end" width={100}>
                  ACTIONS
                </TableColumn>
              </TableHeader>
              <TableBody emptyContent="This folder is empty" isLoading={listLoading}>
                {contents.map((item) => (
                  <TableRow key={item.path}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${item.isDir ? "bg-secondary/10 text-secondary" : "bg-default-100 text-default-600"}`}
                        >
                          {item.isDir ? <Folder size={20} /> : <FileIcon size={20} />}
                        </div>
                        {item.isDir ? (
                          <Button
                            variant="light"
                            className="p-0 h-auto min-w-0 font-medium text-foreground hover:text-primary transition-colors bg-transparent text-base"
                            onClick={() => setCurrentPath(item.path)}
                          >
                            {item.name}
                          </Button>
                        ) : item.name.match(/\.html?$/) ? (
                          <a
                            href={`/api/shares/${id}/download?p=${encodeURIComponent(password)}&path=${encodeURIComponent(item.path)}&inline=1`}
                            className="font-medium text-base text-foreground hover:text-primary transition-colors cursor-pointer"
                          >
                            {item.name}
                          </a>
                        ) : (
                          <span className="font-medium text-base">{item.name}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.isDir ? (
                        <Chip size="sm" variant="flat" color="secondary">
                          Folder
                        </Chip>
                      ) : (
                        <span className="text-default-500 text-small">{formatSize(item.size)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {!item.isDir && (
                        <div className="flex items-center gap-1">
                          <Tooltip content="Preview">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="flat"
                              onPress={() => {
                                setPreviewFile(item);
                                onPreviewOpen();
                              }}
                            >
                              <Eye size={18} />
                            </Button>
                          </Tooltip>
                          <Tooltip content="Download">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="flat"
                              color="success"
                              onClick={() => handleDownload(item.path)}
                            >
                              <Download size={18} />
                            </Button>
                          </Tooltip>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <PreviewModal
        isOpen={isPreviewOpen}
        onOpenChange={onPreviewOpenChange}
        file={previewFile}
        rawUrlBuilder={(path) =>
          `/api/shares/${id}/download?p=${encodeURIComponent(password)}&path=${encodeURIComponent(path)}&inline=1`
        }
      />

      {/* Zip Progress Indicator */}
      <AnimatePresence>
        {zipStatus.active && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 right-8 z-100 w-[320px]"
          >
            <Card className="border-primary/20 shadow-2xl bg-background/80 backdrop-blur-2xl">
              <CardBody className="p-5 gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-xl text-primary animate-spin">
                    <Loader2 size={24} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-bold text-small truncate">Zipping Folder...</p>
                    <p className="text-tiny text-default-500 truncate">{zipStatus.fileName}</p>
                  </div>
                  <span className="font-mono text-primary font-bold">{zipStatus.progress}%</span>
                </div>
                <div className="w-full bg-default-100 h-1.5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${zipStatus.progress}%` }}
                    transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                  />
                </div>
              </CardBody>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ShareView;
