import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

export interface FileItem {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
}

export const fetchPublicFiles = (path: string = "") =>
  api.get<FileItem[]>(`/files/public?path=${encodeURIComponent(path)}`);

export const login = (username: string, password: string) => api.post("/login", { username, password });

export default api;
