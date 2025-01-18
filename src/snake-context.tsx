import {
  createContext,
  FC,
  PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type SnakeContextType = {
  refreshRatePeriod: number;
  piecePixels: number;
  width: number;
  height: number;
  snakeMovePosition: MovingAngle;
  isGameOver: boolean;
  score: number;

  repaint?: (element: HTMLCanvasElement) => void;
};

export const useSnakeContext = () => useContext(SnakeContext);

export const SnakeContext = createContext<SnakeContextType>({
  refreshRatePeriod: 1000,
  piecePixels: 30,
  width: 600,
  height: 300,
  snakeMovePosition: "right",
  isGameOver: false,
  score: 0,
});

// 30
// 600 / 30 = 20
// 300 / 30 = 10

const blockNumber1 = "#166534";
const blockNumber2 = "#22c55e";

const headImages = {
  left: "/Graphics/head_left.png",
  right: "/Graphics/head_right.png",
  top: "/Graphics/head_up.png",
  bottom: "/Graphics/head_down.png",
};

const bodyImages = {
  bottomleft: "/Graphics/body_bottomleft.png",
  bottomright: "/Graphics/body_bottomright.png",
  topleft: "/Graphics/body_topleft.png",
  topright: "/Graphics/body_topright.png",
  horizontal: "/Graphics/body_horizontal.png",
  vertical: "/Graphics/body_vertical.png",
};

const tailImages = {
  left: "/Graphics/tail_left.png",
  right: "/Graphics/tail_right.png",
  up: "/Graphics/tail_up.png",
  down: "/Graphics/tail_down.png",
};

const appleImage = "/Graphics/apple.png";

export type Block = [number, number];

const resolveTailPosition = (
  block: [number, number],
  nextBlock: [number, number]
) => {
  const w = 20;
  const h = 10;
  const dx = (nextBlock[0] - block[0] + w) % w;
  const dy = (nextBlock[1] - block[1] + h) % h;

  if (dx === 1 || dx === -(w - 1)) {
    return "left";
  }
  if (dx === -1 || dx === w - 1) {
    return "right";
  }
  if (dy === 1 || dy === -(h - 1)) {
    return "up";
  }
  if (dy === -1 || dy === h - 1) {
    return "down";
  }
};

const resolveBodyPosition = (
  beforeBlock: Block,
  block: Block,
  afterBlock: Block
) => {
  if (beforeBlock[1] == block[1] && block[1] == afterBlock[1])
    return "horizontal";

  if (beforeBlock[0] == block[0] && block[0] == afterBlock[0])
    return "vertical";

  if (
    (beforeBlock[0] < block[0] && block[1] < afterBlock[1]) ||
    (afterBlock[0] < block[0] && beforeBlock[1] > block[1])
  )
    return "bottomleft"; // TODO: fix these conditions

  if (
    (beforeBlock[0] > block[0] && block[1] < afterBlock[1]) ||
    (afterBlock[0] > block[0] && block[1] < beforeBlock[1])
  )
    return "bottomright";

  if (
    (beforeBlock[0] < block[0] && block[1] > afterBlock[1]) ||
    (afterBlock[0] < block[0] && block[1] > beforeBlock[1])
  )
    return "topleft";

  if (
    (beforeBlock[1] < block[1] && block[0] < afterBlock[0]) ||
    (afterBlock[1] < block[1] && block[0] < beforeBlock[0])
  )
    return "topright";
};

const reEvaluateIfOutOfBounds = (
  block: Block,
  width: number,
  height: number,
  piecePixels: number
): Block => {
  let newX = block[0];
  let newY = block[1];

  if (block[0] < 0) {
    newX = width / piecePixels - 1;
  } else if (block[0] * piecePixels >= width) {
    newX = 0;
  }

  if (block[1] < 0) {
    newY = height / piecePixels - 1;
  } else if (block[1] * piecePixels >= height) {
    newY = 0;
  }

  return [newX, newY];
};

export type MovingAngle = "right" | "left" | "bottom" | "top";

const isPositionsEqual = (position1: Block, position2: Block) => {
  return position1[0] === position2[0] && position1[1] === position2[1];
};

const chooseFreeRandomBlock = (
  width: number,
  height: number,
  piecePixels: number,
  blockedPositions: Block[]
): Block => {
  const allBlocks: Block[] = [];

  for (let x = 0; x < width / piecePixels; x++) {
    for (let y = 0; y < height / piecePixels; y++) {
      allBlocks.push([x, y]);
    }
  }

  const freeBlocks = allBlocks.filter(
    (block) =>
      !blockedPositions.some((blocked) => isPositionsEqual(block, blocked))
  );

  if (freeBlocks.length === 0) {
    throw new Error("No free blocks available");
  }

  const randomIndex = Math.floor(Math.random() * freeBlocks.length);

  return freeBlocks[randomIndex];
};

const SnakeContextProvider: FC<
  PropsWithChildren & { width: number; height: number; piecePixels: number }
> = ({ children, width, height, piecePixels }) => {
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const applePosition = useRef<Block>([1, 1]);
  const [snakeMovePosition, setSnakeMovePosition] =
    useState<MovingAngle>("right");
  const snakePositions = useRef<Block[]>([
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
  ]);
  const [renderTrigger, setRenderTrigger] = useState(false);

  const [cachedImages, setCachedImages] = useState<{
    [key: string]: HTMLImageElement;
  } | null>(null);

  const renderImageToBlock = (
    x: number,
    y: number,
    src: string,
    ctx: CanvasRenderingContext2D
  ) => {
    if (!cachedImages) return;

    const image = cachedImages[src];

    if (!image) return;

    ctx.drawImage(image, x, y);
  };

  const renderApple = (context: CanvasRenderingContext2D) => {
    const [x, y] = applePosition.current;
    renderImageToBlock(
      x * piecePixels,
      y * piecePixels,
      "/Graphics/apple.png",
      context
    );
  };

  const removePreviousPaint = (context: CanvasRenderingContext2D) => {
    context.clearRect(0, 0, width, height);
  };

  const renderBackgroundPieces = (ctx: CanvasRenderingContext2D) => {
    for (let i = 0; i < width / piecePixels; i++) {
      for (let j = 0; j < height / piecePixels; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? blockNumber1 : blockNumber2;

        ctx.fillRect(
          i * piecePixels,
          j * piecePixels,
          piecePixels,
          piecePixels
        );
      }
    }
  };

  const renderSnake = (ctx: CanvasRenderingContext2D) => {
    if (snakePositions.current.length < 3)
      throw new Error("Cannot render snake because the length is lower than 3");

    const tail = snakePositions.current[0];
    const head = snakePositions.current.at(-1)!;
    const bodySlices = snakePositions.current.slice(1, -1);

    renderImageToBlock(
      head[0] * piecePixels,
      head[1] * piecePixels,
      headImages[snakeMovePosition],
      ctx
    );

    renderImageToBlock(
      tail[0] * piecePixels,
      tail[1] * piecePixels,
      tailImages[resolveTailPosition(tail, bodySlices[0])],
      ctx
    );

    let previousBlock = tail;
    let counter = 1;

    for (const slice of bodySlices) {
      let nextBlock = bodySlices[counter] ?? head;
      renderImageToBlock(
        slice[0] * piecePixels,
        slice[1] * piecePixels,
        bodyImages[resolveBodyPosition(previousBlock, slice, nextBlock)!],
        ctx
      );
      previousBlock = slice;
      counter++;
    }
  };

  const moveSnakeToTheFront = () => {
    const removedPosition = snakePositions.current[0];
    snakePositions.current.splice(0, 1);

    const head = snakePositions.current.at(-1)!;

    let newPosition: Block;

    switch (snakeMovePosition) {
      case "bottom":
        newPosition = [head[0], head[1] + 1];
        break;
      case "top":
        newPosition = [head[0], head[1] - 1];
        break;

      case "right":
        newPosition = [head[0] + 1, head[1]];
        break;
      case "left":
        newPosition = [head[0] - 1, head[1]];
        break;
    }

    snakePositions.current.push(
      reEvaluateIfOutOfBounds(newPosition, width, height, piecePixels)
    );

    return removedPosition;
  };

  const checkIfHitApple = (tempRemovedPosition: Block) => {
    const head = snakePositions.current.at(-1)!;

    if (isPositionsEqual(head, applePosition.current)) {
      snakePositions.current.unshift(tempRemovedPosition);
      applePosition.current = chooseFreeRandomBlock(
        width,
        height,
        piecePixels,
        snakePositions.current
      );
      setScore((prevScore) => prevScore + 1);

      setRenderTrigger((value) => !value);

      return true;
    }

    return false;
  };

  const checkIfGameOver = () => {
    const seenBlocks = new Set();

    for (const block of snakePositions.current) {
      const blockKey = block.toString();

      if (seenBlocks.has(blockKey)) {
        setIsGameOver(true);
        return true;
      }

      seenBlocks.add(blockKey);
    }

    return false;
  };

  const repaint = (c: HTMLCanvasElement) => {
    const ctx = c.getContext("2d");

    if (!ctx || !cachedImages || isGameOver) return;

    removePreviousPaint(ctx);
    renderBackgroundPieces(ctx);
    const tempRemovedPosition = moveSnakeToTheFront();
    checkIfHitApple(tempRemovedPosition);
    checkIfGameOver();
    renderApple(ctx);
    renderSnake(ctx);
  };

  useEffect(() => {
    const cacheInitialImages = () => {
      const images = [
        ...Object.values(tailImages),
        ...Object.values(bodyImages),
        ...Object.values(headImages),
        appleImage,
      ];

      Promise.all(
        images.map((imageSrc) => {
          const image = new Image();

          const promise = new Promise<[string, HTMLImageElement]>((resolve) => {
            image.onload = () => resolve([imageSrc, image]);
          });

          image.src = imageSrc;

          return promise;
        })
      ).then((images) => {
        const result: { [key: string]: HTMLImageElement } = {};

        images.reduce((prev, current) => {
          prev[current[0]] = current[1];

          return prev;
        }, result);

        setCachedImages(result);
      });
    };

    cacheInitialImages();
  }, []);

  useEffect(() => {
    const onKeyboardPressed = (e: KeyboardEvent) => {
      switch (e.code) {
        case "ArrowUp":
          if (snakeMovePosition === "bottom") return;
          setSnakeMovePosition("top");
          break;
        case "ArrowDown":
          if (snakeMovePosition === "top") return;
          setSnakeMovePosition("bottom");
          break;
        case "ArrowLeft":
          if (snakeMovePosition === "right") return;
          setSnakeMovePosition("left");
          break;
        case "ArrowRight":
          if (snakeMovePosition === "left") return;
          setSnakeMovePosition("right");
          break;
      }
    };

    document.addEventListener("keydown", onKeyboardPressed);

    return () => {
      document.removeEventListener("keydown", onKeyboardPressed);
    };
  }, [snakeMovePosition]);

  return (
    <SnakeContext.Provider
      value={{
        refreshRatePeriod: 300,
        piecePixels,
        repaint,
        width,
        height,
        snakeMovePosition,
        isGameOver,
        score,
      }}
    >
      {children}
    </SnakeContext.Provider>
  );
};

export default SnakeContextProvider;
