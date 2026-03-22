import { useEffect } from "react";
import { Button } from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

const NotFound = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "ezfs - 404 Not Found";
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative mb-8"
      >
        <div className="p-8 rounded-full bg-danger/10 border-2 border-danger/20 relative z-10">
          <FileQuestion size={80} className="text-danger animate-pulse" />
        </div>
        <div className="absolute -inset-4 bg-danger/5 rounded-full blur-2xl z-0" />
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <h1 className="text-6xl md:text-8xl font-black text-foreground mb-4 tracking-tighter">
          4<span className="text-danger">0</span>4
        </h1>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">Oops! Page Not Found</h2>
        <p className="text-default-500 max-w-md mx-auto mb-10 text-lg">
          The path you are looking for doesn't exist or has been moved. Please check the URL or return to home.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            variant="flat"
            onPress={() => navigate(-1)}
            startContent={<ArrowLeft size={18} />}
            className="w-full sm:w-auto font-bold"
          >
            Go Back
          </Button>
          <Button
            size="lg"
            color="primary"
            onPress={() => navigate("/")}
            startContent={<Home size={18} />}
            className="w-full sm:w-auto font-bold shadow-lg shadow-primary/20"
          >
            Return Home
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 0.8, duration: 1 }}
        className="mt-20 text-tiny text-foreground font-medium uppercase tracking-[0.3em]"
      >
        EZFS
      </motion.div>
    </div>
  );
};

export default NotFound;
