"use client";
import React, {
  useEffect,
  useRef,
  useState,
  createContext,
  useContext,
} from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import gsap from "gsap";

interface CarouselProps {
  items: JSX.Element[];
  initialScroll?: number;
}

export const CarouselContext = createContext<{
  onCardClose: (index: number) => void;
  currentIndex: number;
}>({
  onCardClose: () => {},
  currentIndex: 0,
});

export const Carousel = ({ items, initialScroll = 0 }: CarouselProps) => {
  const carouselRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const scrollInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (carouselRef.current && items.length > 0) {
      // Snap to middle set on mount
      const singleSetWidth = carouselRef.current.scrollWidth / 3;
      carouselRef.current.scrollLeft = singleSetWidth;
      checkScrollability();
    }
  }, [items.length]);

  const checkLoop = () => {
    if (carouselRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
      const singleSetWidth = scrollWidth / 3;

      if (scrollLeft < 50) {
        carouselRef.current.scrollLeft = scrollLeft + singleSetWidth;
      } else if (scrollLeft >= (singleSetWidth * 2) + 200) {
         // This assumes the items are enough to fill more than one screen
         carouselRef.current.scrollLeft = scrollLeft - singleSetWidth;
      }
    }
  };

  useEffect(() => {
    if (!isHovered && items.length > 0) {
      scrollInterval.current = setInterval(() => {
        if (carouselRef.current) {
          const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
          if (scrollLeft + clientWidth >= scrollWidth - 20) {
            // No reset needed because of the triple-item loop, just keep moving
            gsap.to(carouselRef.current, {
              scrollLeft: scrollLeft + (window.innerWidth < 768 ? 250 : 400),
              duration: 1.2,
              ease: "power2.out",
              onComplete: () => {
                checkScrollability();
                checkLoop();
              }
            });
          } else {
            gsap.to(carouselRef.current, {
              scrollLeft: scrollLeft + (window.innerWidth < 768 ? 250 : 400),
              duration: 1.2,
              ease: "power2.out",
              onComplete: () => {
                checkScrollability();
                checkLoop();
              }
            });
          }
        }
      }, 5000);
    } else {
      if (scrollInterval.current) clearInterval(scrollInterval.current);
    }
    return () => {
      if (scrollInterval.current) clearInterval(scrollInterval.current);
    };
  }, [isHovered, items.length]);

  const checkScrollability = () => {
    if (carouselRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  const scrollLeft = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -300, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 300, behavior: "smooth" });
    }
  };

  const handleCardClose = (index: number) => {
    if (carouselRef.current) {
      const cardWidth = window.innerWidth < 768 ? 230 : 384; 
      const gap = window.innerWidth < 768 ? 16 : 24;
      const scrollPosition = (cardWidth + gap) * (index + 1);
      carouselRef.current.scrollTo({
        left: scrollPosition,
        behavior: "smooth",
      });
      setCurrentIndex(index);
    }
  };

  return (
    <CarouselContext.Provider value={{ onCardClose: handleCardClose, currentIndex }}>
      <div 
        className="relative w-full"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className="flex w-full overflow-x-scroll overscroll-x-auto py-10 md:py-20 scroll-smooth [scrollbar-width:none] snap-x snap-mandatory"
          ref={carouselRef}
          onScroll={() => {
            checkScrollability();
            checkLoop();
          }}
        >
          <div className="flex flex-row justify-start gap-4 pl-4 max-w-[5000%] md:gap-6 md:pl-0">
            {/* Triple set for infinite loop */}
            {[...items, ...items, ...items].map((item, index) => (
              <motion.div
                key={"card" + index}
                className="rounded-3xl snap-center md:snap-start"
              >
                {item}
              </motion.div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 mr-4 md:mr-10">
          <button
            className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50 transition-colors"
            onClick={scrollLeft}
            disabled={!canScrollLeft}
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <button
            className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50 transition-colors"
            onClick={scrollRight}
            disabled={!canScrollRight}
          >
            <ArrowRight className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </div>
    </CarouselContext.Provider>
  );
};

export const Card = ({
  card,
  index,
}: {
  card: { src: string; title: string; category: string; content?: React.ReactNode };
  index: number;
}) => {
  const [open, setOpen] = useState(false);
  const { onCardClose, currentIndex } = useContext(CarouselContext);
  
  // We'll keep it simple for now and just open a modal on click.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [open]);

  return (
    <>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 h-screen z-50 overflow-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-black/60 backdrop-blur-lg h-full w-full fixed inset-0"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ type: "spring", damping: 20, stiffness: 100 }}
              className="max-w-3xl mx-auto bg-white min-h-screen md:min-h-fit md:my-10 p-4 md:p-10 rounded-3xl relative z-[60] shadow-2xl"
            >
              <button
                className="absolute top-4 right-4 bg-gray-100 items-center justify-center flex hover:bg-gray-200 transition-colors rounded-full h-10 w-10"
                onClick={() => setOpen(false)}
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
              <p className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                {card.category}
              </p>
              <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-10">
                {card.title}
              </h1>
              <div className="w-full h-[300px] md:h-[400px] rounded-2xl overflow-hidden mb-10 relative">
                 <img src={card.src} className="w-full h-full object-cover" alt={card.title} />
              </div>
              <div className="prose prose-lg max-w-none text-gray-600">
                 {card.content}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <motion.button
        onClick={() => setOpen(true)}
        className="rounded-3xl bg-gray-100 hover:shadow-2xl transition-all h-[400px] md:h-[500px] w-64 md:w-[24rem] overflow-hidden flex flex-col items-start justify-end relative group outline-none ring-0 text-left cursor-pointer"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10 pointer-events-none" />
        <div className="relative z-20 p-6 md:p-10 w-full">
          <p className="text-white text-xs md:text-sm font-black uppercase tracking-[0.2em] mb-2 opacity-80 font-[family-name:var(--font-poppins),sans-serif]">
            {card.category}
          </p>
          <p className="text-white text-2xl md:text-4xl font-black leading-tight drop-shadow-2xl font-[family-name:var(--font-poppins),sans-serif]">
            {card.title}
          </p>
        </div>
        <img
          src={card.src}
          alt={card.title}
          className="absolute inset-0 z-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
      </motion.button>
    </>
  );
};
