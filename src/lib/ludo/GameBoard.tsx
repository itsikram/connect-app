import React from 'react';
import Svg, {
  Circle,
  Image as SvgImage,
  Path,
  Polygon,
  Rect,
} from 'react-native-svg';
import {
  BOARD_GRID_STROKE,
  BOARD_OUTER_STROKE,
  COLORS,
} from './constants';
import { getPlayerIndexForBoardSeat } from './helpers';
import type { Player } from './types';

interface GameBoardProps {
  boardSize: number;
  cellSize: number;
  players: Player[];
  selectedPlayerCount: number;
}

const renderSafeStar = (
  col: number,
  row: number,
  color: string,
  key: string,
  cellSize: number,
) => {
  const cx = (col + 0.5) * cellSize;
  const cy = (row + 0.5) * cellSize;
  const r = cellSize * 0.32;
  const points: string[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.42;
    points.push(`${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`);
  }
  return (
    <Polygon
      key={key}
      points={points.join(' ')}
      fill={color}
      stroke={BOARD_OUTER_STROKE}
      strokeWidth={0.8}
      opacity={0.95}
    />
  );
};

export const GameBoard: React.FC<GameBoardProps> = ({
  boardSize,
  cellSize,
  players,
  selectedPlayerCount,
}) => {
  const stroke = BOARD_OUTER_STROKE;
  const elems: React.ReactNode[] = [];

  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 15; col++) {
      elems.push(
        <Rect
          key={`cell-${row}-${col}`}
          x={col * cellSize}
          y={row * cellSize}
          width={cellSize}
          height={cellSize}
          fill="#FAFAF8"
          stroke={BOARD_GRID_STROKE}
          strokeWidth={0.75}
        />,
      );
    }
  }

  const drawHome = (x0: number, y0: number, color: string, idx: number) => {
    elems.push(
      <Rect
        key={`home-outer-${x0}-${y0}`}
        x={x0 * cellSize}
        y={y0 * cellSize}
        width={cellSize * 6}
        height={cellSize * 6}
        fill={color}
        stroke={stroke}
        strokeWidth={1.5}
        rx={cellSize * 0.15}
      />,
    );
    const innerX = (x0 + 1) * cellSize;
    const innerY = (y0 + 1) * cellSize;
    const innerW = cellSize * 4;
    const innerH = cellSize * 4;
    const playerIndex = getPlayerIndexForBoardSeat(idx, selectedPlayerCount);
    const homePlayer = playerIndex === null ? null : players[playerIndex];
    const coverUrl =
      homePlayer?.cover || (homePlayer as any)?.coverPic || (homePlayer as any)?.profileCover;

    if (coverUrl && playerIndex !== null) {
      elems.push(
        <SvgImage
          key={`home-cover-${x0}-${y0}`}
          href={coverUrl}
          x={innerX}
          y={innerY}
          width={innerW}
          height={innerH}
          preserveAspectRatio="xMidYMid slice"
        />,
      );
      elems.push(
        <Rect
          key={`home-cover-overlay-${x0}-${y0}`}
          x={innerX}
          y={innerY}
          width={innerW}
          height={innerH}
          fill="rgba(0,0,0,0.45)"
        />,
      );
      elems.push(
        <Rect
          key={`home-inner-border-${x0}-${y0}`}
          x={innerX}
          y={innerY}
          width={innerW}
          height={innerH}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          rx={cellSize * 0.1}
        />,
      );
    } else {
      elems.push(
        <Rect
          key={`home-inner-${x0}-${y0}`}
          x={innerX}
          y={innerY}
          width={innerW}
          height={innerH}
          fill="#FFFEFA"
          stroke={stroke}
          strokeWidth={1.5}
          rx={cellSize * 0.1}
        />,
      );
    }

    const cx = (x0 + 1) * cellSize + cellSize * 2;
    const cy = (y0 + 1) * cellSize + cellSize * 2;
    const pipRadius = cellSize * 0.3;
    const gap = cellSize * 0.45;
    const offsets = [
      [-gap, -gap],
      [gap, -gap],
      [-gap, gap],
      [gap, gap],
    ];
    offsets.forEach((o, i) => {
      elems.push(
        <Circle
          key={`pip-${x0}-${y0}-${i}`}
          cx={cx + o[0]}
          cy={cy + o[1]}
          r={pipRadius}
          fill={color}
          stroke={stroke}
          strokeWidth={1.5}
        />,
      );
      elems.push(
        <Circle
          key={`pip-inner-${x0}-${y0}-${i}`}
          cx={cx + o[0]}
          cy={cy + o[1]}
          r={pipRadius * 0.55}
          fill="rgba(255,255,255,0.35)"
        />,
      );
    });
  };

  drawHome(0, 0, COLORS[0], 0);
  drawHome(9, 0, COLORS[1], 1);
  drawHome(0, 9, COLORS[2], 2);
  drawHome(9, 9, COLORS[3], 3);

  for (let c = 0; c < 15; c++) {
    elems.push(
      <Rect
        key={`hpath-${c}`}
        x={c * cellSize}
        y={7 * cellSize}
        width={cellSize}
        height={cellSize}
        fill="#FFFEFA"
        stroke={BOARD_GRID_STROKE}
        strokeWidth={0.75}
      />,
    );
  }
  for (let r = 0; r < 15; r++) {
    elems.push(
      <Rect
        key={`vpath-${r}`}
        x={7 * cellSize}
        y={r * cellSize}
        width={cellSize}
        height={cellSize}
        fill="#FFFEFA"
        stroke={BOARD_GRID_STROKE}
        strokeWidth={0.75}
      />,
    );
  }

  for (let r = 1; r <= 5; r++) {
    elems.push(
      <Rect
        key={`green-col-${r}`}
        x={7 * cellSize}
        y={r * cellSize}
        width={cellSize}
        height={cellSize}
        fill={COLORS[1]}
        stroke={BOARD_GRID_STROKE}
        strokeWidth={0.75}
      />,
    );
  }
  for (let c = 9; c <= 13; c++) {
    elems.push(
      <Rect
        key={`yellow-row-${c}`}
        x={c * cellSize}
        y={7 * cellSize}
        width={cellSize}
        height={cellSize}
        fill={COLORS[3]}
        stroke={BOARD_GRID_STROKE}
        strokeWidth={0.75}
      />,
    );
  }
  for (let r = 9; r <= 12; r++) {
    elems.push(
      <Rect
        key={`blue-col-${r}`}
        x={7 * cellSize}
        y={r * cellSize}
        width={cellSize}
        height={cellSize}
        fill={COLORS[2]}
        stroke={BOARD_GRID_STROKE}
        strokeWidth={0.75}
      />,
    );
  }
  for (let c = 1; c <= 5; c++) {
    elems.push(
      <Rect
        key={`red-row-${c}`}
        x={c * cellSize}
        y={7 * cellSize}
        width={cellSize}
        height={cellSize}
        fill={COLORS[0]}
        stroke={BOARD_GRID_STROKE}
        strokeWidth={0.75}
      />,
    );
  }

  const cx = 7.5 * cellSize;
  const cy = 7.5 * cellSize;
  const xLeft = 6 * cellSize;
  const xRight = 9 * cellSize;
  const yTop = 6 * cellSize;
  const yBottom = 9 * cellSize;

  elems.push(
    <Path
      key="center-tri-green"
      d={`M ${xLeft} ${yTop} L ${xRight} ${yTop} L ${cx} ${cy} Z`}
      fill={COLORS[1]}
      stroke={stroke}
      strokeWidth={1}
    />,
  );
  elems.push(
    <Path
      key="center-tri-yellow"
      d={`M ${xRight} ${yTop} L ${xRight} ${yBottom} L ${cx} ${cy} Z`}
      fill={COLORS[3]}
      stroke={stroke}
      strokeWidth={1}
    />,
  );
  elems.push(
    <Path
      key="center-tri-blue"
      d={`M ${xLeft} ${yBottom} L ${xRight} ${yBottom} L ${cx} ${cy} Z`}
      fill={COLORS[2]}
      stroke={stroke}
      strokeWidth={1}
    />,
  );
  elems.push(
    <Path
      key="center-tri-red"
      d={`M ${xLeft} ${yTop} L ${xLeft} ${yBottom} L ${cx} ${cy} Z`}
      fill={COLORS[0]}
      stroke={stroke}
      strokeWidth={1}
    />,
  );

  elems.push(
    <Rect key="highlight-1-6" x={1 * cellSize} y={6 * cellSize} width={cellSize} height={cellSize} fill={COLORS[0]} stroke={BOARD_GRID_STROKE} strokeWidth={0.75} />,
  );
  elems.push(
    <Rect key="highlight-8-1" x={8 * cellSize} y={1 * cellSize} width={cellSize} height={cellSize} fill={COLORS[1]} stroke={BOARD_GRID_STROKE} strokeWidth={0.75} />,
  );
  elems.push(
    <Rect key="highlight-6-13" x={6 * cellSize} y={13 * cellSize} width={cellSize} height={cellSize} fill={COLORS[2]} stroke={BOARD_GRID_STROKE} strokeWidth={0.75} />,
  );
  elems.push(
    <Rect key="highlight-13-8" x={13 * cellSize} y={8 * cellSize} width={cellSize} height={cellSize} fill={COLORS[3]} stroke={BOARD_GRID_STROKE} strokeWidth={0.75} />,
  );
  elems.push(
    <Rect key="force-blue-7-12" x={7 * cellSize} y={13 * cellSize} width={cellSize} height={cellSize} fill={COLORS[2]} stroke={BOARD_GRID_STROKE} strokeWidth={0.75} />,
  );

  elems.push(renderSafeStar(2, 7, '#FFFEFA', 'star-2-7', cellSize));
  elems.push(renderSafeStar(7, 2, '#FFFEFA', 'star-7-2', cellSize));
  elems.push(renderSafeStar(13, 7, '#FFFEFA', 'star-13-7', cellSize));
  elems.push(renderSafeStar(7, 13, '#FFFEFA', 'star-7-13', cellSize));
  elems.push(renderSafeStar(1, 6, 'rgba(255,255,255,0.85)', 'star-1-6', cellSize));
  elems.push(renderSafeStar(8, 1, 'rgba(255,255,255,0.85)', 'star-8-1', cellSize));
  elems.push(renderSafeStar(6, 13, 'rgba(255,255,255,0.85)', 'star-6-13', cellSize));
  elems.push(renderSafeStar(13, 8, 'rgba(255,255,255,0.85)', 'star-13-8', cellSize));

  return (
    <Svg width={boardSize} height={boardSize} viewBox={`0 0 ${boardSize} ${boardSize}`}>
      <Rect
        x={0}
        y={0}
        width={boardSize}
        height={boardSize}
        fill="#FAFAF8"
        stroke={BOARD_OUTER_STROKE}
        strokeWidth={2}
        rx={12}
        ry={12}
      />
      {elems}
    </Svg>
  );
};
