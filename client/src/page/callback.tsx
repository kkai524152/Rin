import {useEffect} from "react";
import {setCookie} from "typescript-cookie";
import {useLocation, useSearch} from "wouter";

export function CallbackPage() {
    const searchParams = new URLSearchParams(useSearch());
    const [, setLocation] = useLocation();
    useEffect(() => {
        const token = searchParams.get('token');
        if (token) {
            // 动态获取根域名，支持子域名共享 Cookie
            const hostname = window.location.hostname;
            const domainParts = hostname.split('.');
            // 如果是子域名（如 rin.001211.xyz），提取根域名（.001211.xyz）
            const rootDomain = domainParts.length > 2 ? '.' + domainParts.slice(-2).join('.') : hostname;
            
            setCookie('token', token, { expires: 7, path: '/', domain: rootDomain })
            setLocation("/");
        }
    }, [searchParams]);
    return (<>
        <div className="w-screen h-screen flex justify-center items-center">
            <div className="text-center text-black p-4 text-xl font-bold">
                <p>
                    Waiting...
                </p>
            </div>
        </div>
    </>)
}