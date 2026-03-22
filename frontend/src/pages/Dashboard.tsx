import { useEffect, useState } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  useDisclosure,
  Card,
  CardBody,
  Breadcrumbs,
  BreadcrumbItem,
  Tooltip,
  Chip,
  Snippet,
} from "@heroui/react";
import {
  Folder,
  File as FileIcon,
  Share as ShareIcon,
  ChevronRight,
  Lock,
  Globe,
  Eye,
  Download,
  Settings,
  User,
  Calendar,
  Hash,
  Trash2,
  ExternalLink,
} from "lucide-react";
import axios from "../utils/api";
import { useNavigate } from "react-router-dom";
import PreviewModal from "../components/PreviewModal";
import JSZip from "jszip";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface FileItem {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
}

interface ShareItem {
  id: string;
  file_path: string;
  is_folder: boolean;
  expires_at: number;
  max_access: number;
  access_count: number;
  created_at: number;
}

interface ShareUpdateData {
  password?: string;
  expires_at?: string | null;
  max_access?: number;
}

const Dashboard = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [password, setPassword] = useState("");
  const [expiryAt, setExpiryAt] = useState("");
  const [maxAccess, setMaxAccess] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [zipStatus, setZipStatus] = useState<{ active: boolean; progress: number; fileName: string }>({
    active: false,
    progress: 0,
    fileName: "",
  });
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const [shares, setShares] = useState<ShareItem[]>([]);
  const [isSharesLoading, setIsSharesLoading] = useState(false);
  const [editingShare, setEditingShare] = useState<ShareItem | null>(null);

  const { isOpen: isShareOpen, onOpen: onShareOpen, onOpenChange: onShareOpenChange } = useDisclosure();
  const { isOpen: isPreviewOpen, onOpen: onPreviewOpen, onOpenChange: onPreviewOpenChange } = useDisclosure();
  const { isOpen: isProfileOpen, onOpen: onProfileOpen, onOpenChange: onProfileOpenChange } = useDisclosure();
  const {
    isOpen: isManageSharesOpen,
    onOpen: onManageSharesOpen,
    onOpenChange: onManageSharesOpenChange,
  } = useDisclosure();
  const { isOpen: isEditShareOpen, onOpen: onEditShareOpen, onOpenChange: onEditShareOpenChange } = useDisclosure();
  const navigate = useNavigate();

  // Edit Share State
  const [editPassword, setEditPassword] = useState("");
  const [editExpiryAt, setEditExpiryAt] = useState("");
  const [editMaxAccess, setEditMaxAccess] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await axios.get("/admin/status");
      } catch {
        navigate("/admin");
      }
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    document.title = currentPath ? `ezfs - ${currentPath}` : "ezfs - Private";
  }, [currentPath]);

  const fetchFiles = async (path: string = "") => {
    setIsLoading(true);
    try {
      const res = await axios.get(`/admin/files/private?path=${path}`);
      setFiles(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadFolder = async (folder: FileItem) => {
    const zip = new JSZip();

    setZipStatus({ active: true, progress: 0, fileName: folder.name });

    const addFolderToZip = async (currentPath: string, zipFolder: JSZip) => {
      const res = await axios.get(`/admin/files/private?path=${currentPath}`);
      const items: FileItem[] = res.data || [];

      for (const item of items) {
        if (item.is_dir) {
          const newZipFolder = zipFolder.folder(item.name);
          if (newZipFolder) {
            await addFolderToZip(item.path, newZipFolder);
          }
        } else {
          const fileRes = await axios.get(`/admin/files/raw/${item.path}`, { responseType: "blob" });
          zipFolder.file(item.name, fileRes.data);
        }
      }
    };

    try {
      setIsLoading(true);
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
      setIsLoading(false);
      setZipStatus({ active: false, progress: 0, fileName: "" });
    }
  };

  const downloadFile = async (file: FileItem) => {
    const link = document.createElement("a");
    link.href = `/api/admin/files/raw/${file.path}`;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    fetchFiles(currentPath);
  }, [currentPath]);

  const handleShare = async () => {
    if (!selectedFile) return;
    try {
      const res = await axios.post("/admin/shares", {
        file_path: selectedFile.path,
        is_folder: selectedFile.is_dir,
        password: password || undefined,
        expires_at: expiryAt ? new Date(expiryAt).toISOString() : undefined,
        max_access: maxAccess ? parseInt(maxAccess) : 0,
      });
      const link = `${window.location.origin}/s/${res.data.id}`;
      setShareLink(link);
      fetchShares(); // Refresh list if open
    } catch (err) {
      console.error(err);
    }
  };

  const fetchShares = async () => {
    setIsSharesLoading(true);
    try {
      const res = await axios.get("/admin/shares");
      setShares(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSharesLoading(false);
    }
  };

  const deleteShare = async (id: string) => {
    if (!confirm("Are you sure you want to delete this share?")) return;
    try {
      await axios.delete(`/admin/shares/${id}`);
      fetchShares();
    } catch (err) {
      console.error(err);
    }
  };

  const updateShare = async (id: string, data: ShareUpdateData) => {
    try {
      await axios.patch(`/admin/shares/${id}`, data);
      setEditingShare(null);
      fetchShares();
      onEditShareOpenChange();
    } catch (err) {
      console.error(err);
      alert("Failed to update share");
    }
  };

  const handleUpdateProfile = async () => {
    setIsUpdating(true);
    try {
      await axios.post("/admin/profile", {
        username: newUsername,
        password: newPassword,
      });
      alert("Profile updated successfully!");
      onProfileOpenChange();
      setNewPassword("");
      setNewUsername("");
    } catch (err) {
      console.error(err);
      alert("Failed to update profile");
    } finally {
      setIsUpdating(false);
    }
  };

  const breadcrumbs = currentPath.split("/").filter(Boolean);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-start w-full">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Lock className="text-primary" /> Private Dashboard
          </h1>
          <p className="text-default-500">Manage your private storage and sharing links</p>
        </div>
        <div className="flex gap-2">
          <Button
            color="primary"
            variant="flat"
            startContent={<ShareIcon size={18} />}
            onPress={() => {
              fetchShares();
              onManageSharesOpen();
            }}
            className="font-medium"
          >
            Manage Shares
          </Button>
          <Button
            color="default"
            variant="flat"
            startContent={<Settings size={18} />}
            onPress={onProfileOpen}
            className="font-medium"
          >
            Profile Settings
          </Button>
        </div>
      </div>

      <Card className="bg-background/60 border border-divider shadow-sm" isBlurred>
        <CardBody className="py-3 px-5">
          <Breadcrumbs
            separator={<ChevronRight size={14} />}
            itemClasses={{
              item: "text-small font-medium data-[current=true]:text-primary",
              separator: "text-default-400",
            }}
          >
            <BreadcrumbItem onClick={() => setCurrentPath("")}>Root (Private)</BreadcrumbItem>
            {breadcrumbs.map((crumb, i) => (
              <BreadcrumbItem key={i} onClick={() => setCurrentPath(breadcrumbs.slice(0, i + 1).join("/"))}>
                {crumb}
              </BreadcrumbItem>
            ))}
          </Breadcrumbs>
        </CardBody>
      </Card>

      <Table
        aria-label="Private files"
        className="bg-background/40"
        removeWrapper
        classNames={{
          th: "bg-transparent text-default-500 border-b border-divider",
          tr: "hover:bg-default-100/50 transition-colors group",
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
        <TableBody emptyContent="No files found in private storage" isLoading={isLoading}>
          {(files || []).map((file) => (
            <TableRow key={file.path}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${file.is_dir ? "bg-secondary/10 text-secondary" : "bg-default-100 text-default-600"}`}
                  >
                    {file.is_dir ? <Folder size={20} /> : <FileIcon size={20} />}
                  </div>
                  {file.is_dir ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="light"
                        className="p-0 h-auto min-w-0 font-medium text-foreground hover:text-primary transition-colors bg-transparent text-base"
                        onClick={() => setCurrentPath(file.path)}
                      >
                        {file.name}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="light"
                      className="p-0 h-auto min-w-0 font-medium text-foreground hover:text-primary transition-colors bg-transparent text-base"
                      onClick={() => downloadFile(file)}
                    >
                      {file.name}
                    </Button>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {file.is_dir ? (
                  <Chip size="sm" variant="flat" color="secondary">
                    Folder
                  </Chip>
                ) : (
                  <span className="text-default-500 text-small">{formatSize(file.size)}</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {file.is_dir ? (
                    <>
                      <Tooltip content="Download Folder (Zip)">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          color="secondary"
                          onClick={() => downloadFolder(file)}
                        >
                          <Download size={18} />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Share Folder Link">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          color="primary"
                          onPress={() => {
                            setSelectedFile(file);
                            setShareLink("");
                            setPassword("");
                            onShareOpen();
                          }}
                        >
                          <ShareIcon size={18} />
                        </Button>
                      </Tooltip>
                    </>
                  ) : (
                    <>
                      <Tooltip content="Preview">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          color="secondary"
                          onPress={() => {
                            setPreviewFile(file);
                            onPreviewOpen();
                          }}
                        >
                          <Eye size={18} />
                        </Button>
                      </Tooltip>

                      <Tooltip content="Download">
                        <Button isIconOnly size="sm" variant="flat" color="success" onPress={() => downloadFile(file)}>
                          <Download size={18} />
                        </Button>
                      </Tooltip>

                      <Tooltip content="Share Link">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          color="primary"
                          onPress={() => {
                            setSelectedFile(file);
                            setShareLink("");
                            setPassword("");
                            onShareOpen();
                          }}
                        >
                          <ShareIcon size={18} />
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

      <Modal
        isOpen={isShareOpen}
        onOpenChange={onShareOpenChange}
        backdrop="blur"
        className="dark"
        classNames={{
          base: "bg-background/90 backdrop-blur-xl border border-divider text-foreground",
          header: "border-b border-divider",
          footer: "border-t border-divider",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <span className="text-xl font-bold tracking-tight">Create Private Share</span>
              </ModalHeader>
              <ModalBody className="py-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 p-3 bg-default-100 rounded-xl border border-divider">
                    {!selectedFile?.is_dir && <FileIcon className="text-primary" size={24} />}
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-small font-bold truncate">{selectedFile?.name}</span>
                      {!selectedFile?.is_dir && (
                        <span className="text-tiny text-default-500">{formatSize(selectedFile?.size || 0)}</span>
                      )}
                    </div>
                  </div>

                  <Input
                    label="Protect with Password"
                    placeholder="Leave empty for no password"
                    type="password"
                    variant="bordered"
                    labelPlacement="outside"
                    startContent={<Lock size={18} className="text-default-400" />}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Expiration Date"
                      type="datetime-local"
                      variant="bordered"
                      labelPlacement="outside"
                      startContent={<Calendar size={18} className="text-default-400" />}
                      value={expiryAt}
                      onChange={(e) => setExpiryAt(e.target.value)}
                    />
                    <Input
                      label="Access Limit"
                      placeholder="0 for unlimited"
                      type="number"
                      min={0}
                      variant="bordered"
                      labelPlacement="outside"
                      startContent={<Hash size={18} className="text-default-400" />}
                      value={maxAccess}
                      onChange={(e) => setMaxAccess(Math.max(0, parseInt(e.target.value) || 0).toString())}
                    />
                  </div>

                  {shareLink && (
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-primary font-bold text-small">
                        <Globe size={16} /> Share Link Created
                      </div>
                      <Snippet symbol="" variant="flat" color="primary" className="w-full">
                        {shareLink}
                      </Snippet>
                    </div>
                  )}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                {!shareLink && (
                  <Button color="primary" className="font-bold shadow-lg shadow-primary/20" onPress={handleShare}>
                    Generate Link
                  </Button>
                )}
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <PreviewModal
        isOpen={isPreviewOpen}
        onOpenChange={onPreviewOpenChange}
        file={previewFile}
        baseRawUrl="/api/admin/files/raw"
      />

      <Modal
        isOpen={isProfileOpen}
        onOpenChange={onProfileOpenChange}
        backdrop="blur"
        className="dark"
        classNames={{
          base: "bg-background/90 backdrop-blur-xl border border-divider text-foreground",
          header: "border-b border-divider",
          footer: "border-t border-divider",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <span className="text-xl font-bold tracking-tight">Profile Settings</span>
              </ModalHeader>
              <ModalBody className="py-6 flex flex-col gap-6">
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-full text-primary">
                    <User size={24} />
                  </div>
                  <div>
                    <p className="text-small font-bold text-primary">Security Note</p>
                    <p className="text-tiny text-default-500">
                      Update your login credentials below. Leave empty to keep current.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <Input
                    label="New Username"
                    placeholder="Enter new username"
                    variant="bordered"
                    labelPlacement="outside"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                  />
                  <Input
                    label="New Password"
                    placeholder="Enter new password"
                    type="password"
                    variant="bordered"
                    labelPlacement="outside"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  className="font-bold shadow-lg shadow-primary/20"
                  onPress={handleUpdateProfile}
                  isLoading={isUpdating}
                >
                  Update Profile
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

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

      <Modal
        isOpen={isManageSharesOpen}
        onOpenChange={onManageSharesOpenChange}
        backdrop="blur"
        size="4xl"
        className="dark"
        scrollBehavior="inside"
        classNames={{
          base: "bg-background/90 backdrop-blur-xl border border-divider text-foreground",
          header: "border-b border-divider",
          footer: "border-t border-divider",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <span className="text-xl font-bold tracking-tight">Active Share Links</span>
              </ModalHeader>
              <ModalBody className="py-6 px-0">
                <Table
                  aria-label="Active shares"
                  removeWrapper
                  classNames={{
                    th: "bg-transparent text-default-500 border-b border-divider px-6",
                    td: "py-4 px-6 border-b border-divider/50",
                    tr: "hover:bg-default-100/50 transition-colors",
                  }}
                >
                  <TableHeader>
                    <TableColumn>ITEM</TableColumn>
                    <TableColumn>STATS</TableColumn>
                    <TableColumn>EXPIRY</TableColumn>
                    <TableColumn align="end">ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No active share links" isLoading={isSharesLoading}>
                    {shares.map((share) => (
                      <TableRow key={share.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold flex items-center gap-2">
                              {share.is_folder ? (
                                <Folder size={16} className="text-secondary" />
                              ) : (
                                <FileIcon size={16} className="text-primary" />
                              )}
                              {share.file_path.split("/").pop()}
                            </span>
                            <span className="text-tiny text-default-400 font-mono">ID: {share.id}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Chip size="sm" variant="flat" color="primary">
                              {share.access_count} / {share.max_access || "∞"} accesses
                            </Chip>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-small">
                            {share.expires_at > 0 ? new Date(share.expires_at).toLocaleString() : "Never"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Tooltip content="Edit Settings">
                              <Button
                                isIconOnly
                                size="sm"
                                variant="flat"
                                color="warning"
                                onClick={() => {
                                  setEditingShare(share);
                                  setEditPassword("");
                                  // Convert timestamp to YYYY-MM-DDTHH:MM for datetime-local input
                                  if (share.expires_at > 0) {
                                    const date = new Date(share.expires_at);
                                    const offset = date.getTimezoneOffset() * 60000;
                                    const localTime = new Date(date.getTime() - offset).toISOString().slice(0, 16);
                                    setEditExpiryAt(localTime);
                                  } else {
                                    setEditExpiryAt("");
                                  }
                                  setEditMaxAccess(share.max_access.toString());
                                  onEditShareOpen();
                                }}
                              >
                                <Settings size={16} />
                              </Button>
                            </Tooltip>
                            <Tooltip content="Open Link">
                              <Button
                                isIconOnly
                                size="sm"
                                variant="flat"
                                onClick={() => window.open(`/s/${share.id}`, "_blank")}
                              >
                                <ExternalLink size={16} />
                              </Button>
                            </Tooltip>
                            <Tooltip content="Delete Share">
                              <Button
                                isIconOnly
                                size="sm"
                                variant="flat"
                                color="danger"
                                onClick={() => deleteShare(share.id)}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal
        isOpen={isEditShareOpen}
        onOpenChange={onEditShareOpenChange}
        backdrop="blur"
        className="dark"
        classNames={{
          base: "bg-background/90 backdrop-blur-xl border border-divider text-foreground",
          header: "border-b border-divider",
          footer: "border-t border-divider",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <span className="text-xl font-bold tracking-tight">Edit Share Settings</span>
                <span className="text-tiny text-default-500 font-mono italic">ID: {editingShare?.id}</span>
              </ModalHeader>
              <ModalBody className="py-6">
                <div className="flex flex-col gap-4">
                  <Input
                    label="Update Password"
                    placeholder="Leave empty to keep current, type to change"
                    type="password"
                    variant="bordered"
                    labelPlacement="outside"
                    startContent={<Lock size={18} className="text-default-400" />}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="New Expiration Date"
                      type="datetime-local"
                      variant="bordered"
                      labelPlacement="outside"
                      startContent={<Calendar size={18} className="text-default-400" />}
                      value={editExpiryAt}
                      onChange={(e) => setEditExpiryAt(e.target.value)}
                    />
                    <Input
                      label="New Access Limit"
                      placeholder="0 for unlimited"
                      type="number"
                      min={0}
                      variant="bordered"
                      labelPlacement="outside"
                      startContent={<Hash size={18} className="text-default-400" />}
                      value={editMaxAccess}
                      onChange={(e) => setEditMaxAccess(Math.max(0, parseInt(e.target.value) || 0).toString())}
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="warning"
                  className="font-bold shadow-lg shadow-warning/20"
                  onPress={() =>
                    editingShare && updateShare(editingShare.id, {
                      password: editPassword || undefined,
                      expires_at: editExpiryAt ? new Date(editExpiryAt).toISOString() : null,
                      max_access: editMaxAccess ? parseInt(editMaxAccess) : 0,
                    })
                  }
                >
                  Update Settings
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default Dashboard;
