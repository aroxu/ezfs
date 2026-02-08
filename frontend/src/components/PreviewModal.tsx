import { useState, useEffect } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, ScrollShadow } from "@heroui/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download, X } from "lucide-react";

interface PreviewModalProps {
  isOpen: boolean;
  onOpenChange: () => void;
  file: {
    name: string;
    path: string;
  } | null;
  baseRawUrl?: string; // e.g. "/raw/public" or "/api/files/raw"
}

const PreviewModal = ({ isOpen, onOpenChange, file, baseRawUrl = "/raw/public" }: PreviewModalProps) => {
  const [mdContent, setMdContent] = useState("");

  useEffect(() => {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    const isMarkdown = extension === "md";
    const rawUrl = baseRawUrl + "/" + file.path;

    if (isMarkdown && isOpen) {
      fetch(rawUrl)
        .then((res) => res.text())
        .then((text) => setMdContent(text));
    }
  }, [file, isOpen, baseRawUrl]);

  if (!file) return null;

  const extension = file.name.split(".").pop()?.toLowerCase();
  const rawUrl = baseRawUrl + "/" + file.path;

  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension || "");
  const isVideo = ["mp4", "webm", "ogg"].includes(extension || "");
  const isMarkdown = extension === "md";
  const isPdf = extension === "pdf";
  const isHtml = ["html", "htm"].includes(extension || "");

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      placement="center"
      scrollBehavior="inside"
      backdrop="blur"
      className="dark"
      classNames={{
        base: "bg-background/95 backdrop-blur-xl border border-divider shadow-2xl text-foreground m-0 max-w-[80vw] w-[80vw] h-[80vh] max-h-[80vh] overflow-hidden rounded-2xl",
        header: "border-b border-divider py-4 flex-none",
        body: "p-0 flex-1 overflow-hidden",
        footer: "border-t border-divider flex-none gap-3",
        closeButton: "hover:bg-white/10 transition-colors",
      }}
    >
      <ModalContent className="h-[80vh] max-h-[80vh] flex flex-col">
        {(onClose) => (
          <>
            <ModalHeader>
              <span className="text-xl font-bold tracking-tight">{file.name}</span>
            </ModalHeader>
            <ModalBody>
              <div className="w-full h-full flex items-center justify-center p-6 md:p-8 overflow-hidden">
                {isImage && (
                  <img
                    src={rawUrl}
                    alt={file.name}
                    className="max-w-full max-h-full object-contain rounded-xl shadow-lg border border-divider"
                  />
                )}
                {isVideo && (
                  <video
                    src={rawUrl}
                    controls
                    className="max-w-full max-h-full rounded-xl shadow-lg border border-divider bg-black"
                  />
                )}
                {isMarkdown && (
                  <div className="w-full h-full overflow-hidden flex flex-col">
                    <ScrollShadow className="flex-1 w-full">
                      <div className="prose dark:prose-invert max-w-[1200px] w-full p-8 bg-default-50/50 rounded-2xl border border-divider shadow-inner mx-auto">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{mdContent}</ReactMarkdown>
                      </div>
                    </ScrollShadow>
                  </div>
                )}
                {(isPdf || isHtml) && (
                  <iframe src={rawUrl} className="w-full h-full rounded-xl border border-divider shadow-lg bg-white" />
                )}
                {!isImage && !isVideo && !isMarkdown && !isPdf && !isHtml && (
                  <div className="flex flex-col items-center justify-center py-20 text-default-400">
                    <p className="text-lg">Preview not available for this file type.</p>
                    <p className="text-small">You can download the file below.</p>
                  </div>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" color="default" onPress={onClose} startContent={<X size={18} />}>
                Close
              </Button>
              <Button
                color="primary"
                onPress={() => {
                  const link = document.createElement("a");
                  link.href = rawUrl;
                  link.download = file.name;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="font-semibold shadow-lg shadow-primary/20"
                startContent={<Download size={18} />}
              >
                Download
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default PreviewModal;
