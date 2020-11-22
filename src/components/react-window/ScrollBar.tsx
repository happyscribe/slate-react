import React from 'react';

export const ScrollBar = ({ startIndex, endIndex, childrenLength }) => {
  if (childrenLength === 0) return null;
  let height = Math.max(
    ((endIndex - startIndex + 1) / childrenLength) * 100,
    10
  );
  height = Math.min(Math.round(height / 10) * 10, 80);
  const top = Math.min((startIndex / childrenLength) * 100, 100 - height);
  return (
    <div className="scrollBarContainer">
      <div>
        <div
          style={{
            height: `${height}%`,
            top: `${top}%`,
          }}
        />
      </div>
    </div>
  );
};
