import React from 'react';
export declare const ReactWindow: ({ children }: {
    children: any;
}) => JSX.Element;
export declare const useVirtualization: (childrenLength: any) => {
    startIndex: number;
    endIndex: number;
    containerRef: React.MutableRefObject<undefined>;
    containerStyle: {
        top: string;
        position: string;
        width: string;
    };
    onWheel: (e: any) => void;
};
//# sourceMappingURL=ReactWindow.d.ts.map