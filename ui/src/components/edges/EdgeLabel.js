import React from 'react';
import { getBezierPath, EdgeText } from 'reactflow';

function EdgeLabel({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const constraints = data?.constraints || {};
  const hasConstraints = constraints.departTimeRange || constraints.direct !== undefined;
  
  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      <EdgeText
        x={labelX}
        y={labelY}
        label={
          hasConstraints ? (
            <div className="edge-label">
              {constraints.departTimeRange && (
                <div>🕒 {constraints.departTimeRange}</div>
              )}
              {constraints.direct !== undefined && (
                <div>✈️ {constraints.direct ? 'Direct Only' : 'Any Connections'}</div>
              )}
            </div>
          ) : (
            <div className="edge-label">Click to configure</div>
          )
        }
        labelStyle={{ fill: 'black' }}
        labelShowBg
        labelBgStyle={{ fill: 'rgba(255, 255, 255, 0.8)' }}
        labelBgPadding={[2, 4]}
        labelBgBorderRadius={4}
      />
    </>
  );
}

export default EdgeLabel;