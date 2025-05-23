import classNames from "classnames";
import { useRef, useState, useEffect } from "react";
import { TbReload } from "react-icons/tb";
import { toast } from "react-toastify";
import { FaLaptopCode } from "react-icons/fa6";
import PreviewActions from "./preview-actions";
import { useTranslation } from "react-i18next";

function Preview({
  html,
  isResizing,
  isAiWorking,
  setView,
  setHtml,
  ref,
}: {
  html: string;
  isResizing: boolean;
  isAiWorking: boolean;
  setView: React.Dispatch<React.SetStateAction<"editor" | "preview">>;
  setHtml?: (html: string) => void;
  ref: React.RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [throttledHtml, setThrottledHtml] = useState(html);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const previousIsAiWorkingRef = useRef(isAiWorking);
  const htmlRef = useRef(html);
  
  // 当HTML内容改变时保存到ref中，以便后续使用
  useEffect(() => {
    htmlRef.current = html;
  }, [html]);
  
  // 监测AI生成过程的结束，即使自动刷新关闭也更新内容
  useEffect(() => {
    // 当AI工作状态从工作中变为非工作中时
    if (previousIsAiWorkingRef.current && !isAiWorking) {
      // AI工作结束时，无论自动刷新是否开启，都要更新预览内容
      setThrottledHtml(htmlRef.current);
      console.log("AI工作结束，更新预览内容");
    }
    
    // 更新之前的状态
    previousIsAiWorkingRef.current = isAiWorking;
  }, [isAiWorking]);
  
  // 防止过于频繁刷新iframe，特别是在AI生成过程中
  useEffect(() => {
    // 如果自动刷新关闭，则不实时更新内容
    if (!autoRefresh) return;
    
    // 统一设置节流时间为至少1秒，AI工作时使用更长的节流时间
    const throttleTime = isAiWorking ? 2000 : 1000;
    
    const now = Date.now();
    if (now - lastUpdateTimeRef.current >= throttleTime) {
      setThrottledHtml(html);
      lastUpdateTimeRef.current = now;
    } else {
      // 如果距离上次更新时间不够，设置一个定时器在适当时间后更新
      const timerId = setTimeout(() => {
        setThrottledHtml(html);
        lastUpdateTimeRef.current = Date.now();
      }, throttleTime - (now - lastUpdateTimeRef.current));
      
      return () => clearTimeout(timerId);
    }
  }, [html, isAiWorking, autoRefresh]);

  const handleRefreshIframe = () => {
    // 手动刷新时，直接使用最新的HTML内容
    setThrottledHtml(html);
    
    // 强制刷新iframe以确保内容更新
    if (iframeRef.current) {
      const iframe = iframeRef.current;
      try {
        // 尝试直接刷新iframe内容
        if (iframe.contentWindow) {
          iframe.contentWindow.location.reload();
        } else {
          // 如果无法直接刷新，使用替代方法
          const content = iframe.srcdoc;
          iframe.srcdoc = "";
          setTimeout(() => {
            iframe.srcdoc = content;
          }, 10);
        }
      } catch (error) {
        console.error("刷新iframe失败:", error);
        // 使用备用的重载方法
        const content = html;
        iframe.srcdoc = "";
        setTimeout(() => {
          iframe.srcdoc = content;
        }, 10);
      }
    }
    
    console.log("手动刷新预览内容");
    toast.info(t('preview.refreshPreview'), {
      toastId: 'manualRefresh',
      autoClose: 1000
    });
  };

  // 切换自动刷新状态
  const toggleAutoRefresh = () => {
    // 直接设置新值，避免使用回调函数可能导致的多次执行
    const newState = !autoRefresh;
    setAutoRefresh(newState);
    
    // 如果开启自动刷新，立即更新一次内容
    if (newState) {
      setThrottledHtml(html);
    }
    
    // 使用一次性通知，避免多次触发
    toast.info(newState ? t('preview.autoRefreshOn') : t('preview.autoRefreshOff'), {
      toastId: 'autoRefreshToggle' // 使用固定ID确保相同通知不会重复显示
    });
  };

  // 处理加载模板
  const handleLoadTemplate = (templateHtml: string) => {
    if (setHtml) {
      setHtml(templateHtml);
      toast.success(t('preview.templateLoaded'));
      // 无论自动刷新是否开启，都立即更新预览
      setThrottledHtml(templateHtml);
    }
  };

  return (
    <div
      ref={ref}
      className="w-full border-l border-gray-900 bg-white h-[calc(100dvh-49px)] lg:h-[calc(100dvh-53px)] relative"
      onClick={(e) => {
        if (isAiWorking) {
          e.preventDefault();
          e.stopPropagation();
          toast.warn(t("askAI.working"));
        }
      }}
    >
      <iframe
        ref={iframeRef}
        title="output"
        className={classNames("w-full h-full select-none", {
          "pointer-events-none": isResizing || isAiWorking,
        })}
        srcDoc={throttledHtml}
      />
      {!isAiWorking && (
        <div className="flex items-center justify-between gap-3 absolute bottom-3 lg:bottom-5 right-3 left-3 lg:right-5 lg:left-auto">
        <div className="flex items-center gap-2">
          <button
            className="lg:hidden bg-gray-950 shadow-md text-white text-xs lg:text-sm font-medium py-2 px-3 lg:px-4 rounded-lg flex items-center gap-2 border border-gray-900 hover:brightness-150 transition-all duration-100 cursor-pointer"
            onClick={() => setView("editor")}
          >
            <FaLaptopCode />
            {t("preview.backToEditor")}
          </button>
          <button
            className="bg-white lg:bg-gray-950 shadow-md text-gray-950 lg:text-white text-xs lg:text-sm font-medium py-2 px-3 lg:px-4 rounded-lg flex items-center gap-2 border border-gray-100 lg:border-gray-900 hover:brightness-150 transition-all duration-100 cursor-pointer"
            onClick={handleRefreshIframe}
            title={!autoRefresh ? t('preview.manualRefreshTooltip') : t('preview.refreshPreview')}
          >
            <TbReload />
            {t("preview.refreshPreview")}
          </button>
        </div>
        <PreviewActions 
          html={html} 
          isDisabled={isAiWorking || isResizing} 
          onLoadTemplate={handleLoadTemplate}
          isGenerating={isAiWorking}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={toggleAutoRefresh}
        />
      </div>
      )}
    </div>
  );
}

export default Preview;
