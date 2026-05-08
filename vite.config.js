import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Pdf-revision/',
  build: {
    chunkSizeWarningLimit: 2000, // ขยายลิมิตคำเตือนเป็น 2000 kB เพราะเราใช้ AI
    rollupOptions: {
      output: {
        manualChunks(id) {
          // หั่น Library หนักๆ แยกออกจากกัน เพื่อให้เว็บโหลดเร็วขึ้น
          if (id.includes('node_modules')) {
            if (id.includes('pdfjs-dist')) return 'pdfjs';
            if (id.includes('pdf-lib')) return 'pdf-lib';
            if (id.includes('tesseract.js')) return 'tesseract';
            return 'vendor'; // พวก React และอื่นๆ เอาไว้รวมกัน
          }
        }
      }
    }
  }
})