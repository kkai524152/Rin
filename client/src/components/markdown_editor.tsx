import Editor from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Loading from 'react-loading';
import { useColorMode } from "../utils/darkModeUtils";
import { Markdown } from "./markdown";
import { client } from "../main";
import { headersWithAuth } from "../utils/auth";

interface MarkdownEditorProps {
  content: string;
  setContent: (content: string) => void;
  placeholder?: string;
  height?: string;
}

export function MarkdownEditor({ content, setContent, placeholder = "> Write your content here...", height = "400px" }: MarkdownEditorProps) {
  const { t } = useTranslation();
  const colorMode = useColorMode();
  const editorRef = useRef<editor.IStandaloneCodeEditor>();
  const [preview, setPreview] = useState<'edit' | 'preview' | 'comparison'>('edit');
  const [uploading, setUploading] = useState(false);

  // 根据文件类型生成相应的 Markdown 链接
  function generateMarkdownForFile(file: File, url: string): string {
    const fileName = file.name;
    const fileType = file.type;
    
    // 图片文件
    if (fileType.startsWith('image/')) {
      return `![${fileName}](${url})\n`;
    }
    
    // 视频文件
    if (fileType.startsWith('video/')) {
      return `<video controls>
  <source src="${url}" type="${fileType}">
  您的浏览器不支持视频标签。
</video>

`;
    }
    
    // 音频文件
    if (fileType.startsWith('audio/')) {
      return `<audio controls>
  <source src="${url}" type="${fileType}">
  您的浏览器不支持音频标签。
</audio>

`;
    }
    
    // PDF 文件
    if (fileType === 'application/pdf') {
      return `📄 [${fileName}](${url}) 

> 点击查看 PDF 文件

`;
    }
    
    // 文档文件
    if (fileType.includes('document') || fileType.includes('text') || 
        fileType.includes('spreadsheet') || fileType.includes('presentation') ||
        fileName.match(/\.(doc|docx|xls|xlsx|ppt|pptx|txt|rtf)$/i)) {
      return `📝 [${fileName}](${url})\n\n`;
    }
    
    // 压缩文件
    if (fileType.includes('zip') || fileType.includes('rar') || 
        fileName.match(/\.(zip|rar|7z|tar|gz)$/i)) {
      return `📦 [${fileName}](${url})\n\n`;
    }
    
    // 可执行文件和安装包
    if (fileName.match(/\.(exe|msi|dmg|pkg|deb|rpm|app)$/i)) {
      return `💾 [${fileName}](${url})

> 安装包/可执行文件

`;
    }
    
    // 其他文件类型
    return `📎 [${fileName}](${url})\n\n`;
  }

  function uploadFile(file: File, onSuccess: (url: string) => void, showAlert: (msg: string) => void) {
    client.storage.index
      .post(
        {
          key: file.name,
          file: file,
        },
        {
          headers: headersWithAuth(),
        }
      )
      .then(({ data, error }) => {
        if (error) {
          showAlert(t("upload.failed"));
        }
        if (data) {
          onSuccess(data);
        }
      })
      .catch((e: any) => {
        console.error(e);
        showAlert(t("upload.failed"));
      });
  }


  const handlePaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const clipboardData = event.clipboardData;
    if (clipboardData.files.length === 1) {
      const editor = editorRef.current;
      if (!editor) return;
      editor.trigger(undefined, "undo", undefined);
      setUploading(true);
      const myfile = clipboardData.files[0] as File;
      uploadFile(myfile, (url) => {
        const selection = editor.getSelection();
        if (!selection) return;
        const markdownText = generateMarkdownForFile(myfile, url);
        editor.executeEdits(undefined, [{
          range: selection,
          text: markdownText,
        }]);
        setUploading(false);
      }, (msg) => console.error(msg));
    }
  };

  function UploadImageButton() {
    const uploadRef = useRef<HTMLInputElement>(null);
    
    const upChange = (event: any) => {
      for (let i = 0; i < event.currentTarget.files.length; i++) {
        const file = event.currentTarget.files[i];
        if (file.size > 5 * 1024000) {
          alert("File too large (max 5MB)");
          uploadRef.current!.value = "";
        } else {
          const editor = editorRef.current;
          if (!editor) return;
          const selection = editor.getSelection();
          if (!selection) return;
          setUploading(true);
          uploadFile(file, (url) => {
            setUploading(false);
            const markdownText = generateMarkdownForFile(file, url);
            editor.executeEdits(undefined, [{
              range: selection,
              text: markdownText,
            }]);
          }, (msg) => console.error(msg));
        }
      }
    };
    
    return (
      <button onClick={() => uploadRef.current?.click()} title={t("upload.image")}>
        <input
          ref={uploadRef}
          onChange={upChange}
          className="hidden"
          type="file"
          accept="image/gif,image/jpeg,image/jpg,image/png,image/webp,image/svg+xml"
        />
        <i className="ri-image-add-line" />
      </button>
    );
  }

  function UploadFileButton() {
    const uploadRef = useRef<HTMLInputElement>(null);
    
    const upChange = (event: any) => {
      for (let i = 0; i < event.currentTarget.files.length; i++) {
        const file = event.currentTarget.files[i];
        if (file.size > 50 * 1024 * 1024) { // 50MB 限制
          alert(t("upload.failed$size", { size: "50" }));
          uploadRef.current!.value = "";
        } else {
          const editor = editorRef.current;
          if (!editor) return;
          const selection = editor.getSelection();
          if (!selection) return;
          setUploading(true);
          uploadFile(file, (url) => {
            setUploading(false);
            const markdownText = generateMarkdownForFile(file, url);
            editor.executeEdits(undefined, [{
              range: selection,
              text: markdownText,
            }]);
          }, (msg) => console.error(msg));
        }
      }
    };
    
    return (
      <button onClick={() => uploadRef.current?.click()} title={t("upload.file")}>
        <input
          ref={uploadRef}
          onChange={upChange}
          className="hidden"
          type="file"
          accept="*/*"
        />
        <i className="ri-attachment-line" />
      </button>
    );
  }

  return (
    <div className="flex flex-col mx-4 my-2 md:mx-0 md:my-0 gap-2">
      <div className="flex flex-row space-x-2">
        <button className={`${preview === 'edit' ? "text-theme" : ""}`} onClick={() => setPreview('edit')}> {t("edit")} </button>
        <button className={`${preview === 'preview' ? "text-theme" : ""}`} onClick={() => setPreview('preview')}> {t("preview")} </button>
        <button className={`${preview === 'comparison' ? "text-theme" : ""}`} onClick={() => setPreview('comparison')}> {t("comparison")} </button>
        <div className="flex-grow" />
        {uploading &&
          <div className="flex flex-row space-x-2 items-center">
            <Loading type="spin" color="#FC466B" height={16} width={16} />
            <span className="text-sm text-neutral-500">{t('uploading')}</span>
          </div>
        }
      </div>
      <div className={`grid grid-cols-1 ${preview === 'comparison' ? "sm:grid-cols-2" : ""}`}>
        <div className={"flex flex-col " + (preview === 'preview' ? "hidden" : "")}>
          <div className="flex flex-row justify-start mb-2 space-x-2">
            <UploadImageButton />
            <UploadFileButton />
          </div>
          <div
            className={"relative"}
            onDrop={(e) => {
              e.preventDefault();
              const editor = editorRef.current;
              if (!editor) return;
              for (let i = 0; i < e.dataTransfer.files.length; i++) {
                const selection = editor.getSelection();
                if (!selection) return;
                const file = e.dataTransfer.files[i];
                setUploading(true);
                uploadFile(file, (url) => {
                  setUploading(false);
                  const markdownText = generateMarkdownForFile(file, url);
                  editor.executeEdits(undefined, [{
                    range: selection,
                    text: markdownText,
                  }]);
                }, (msg) => console.error(msg));
              }
            }}
            onPaste={handlePaste}
          >
            <Editor
              onMount={(editor, _) => {
                editorRef.current = editor;
              }}
              height={height}
              defaultLanguage="markdown"
              className=""
              value={content}
              onChange={(data, _) => {
                setContent(data ?? "");
              }}
              theme={colorMode === "dark" ? "vs-dark" : "light"}
              options={{
                wordWrap: "on",
                fontSize: 14,
                lineNumbers: "off",
                dragAndDrop: true,
                pasteAs: { enabled: false }
              }}
            />
          </div>
        </div>
        <div
          className={"px-4 overflow-y-scroll " + (preview !== 'edit' ? "" : "hidden")}
          style={{ height: height }}
        >
          <Markdown content={content ? content : placeholder} />
        </div>
      </div>
    </div>
  );
}