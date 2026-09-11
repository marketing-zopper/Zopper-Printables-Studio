export default function GradientBlobs() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
      <div className="absolute inset-0 bg-zbg" />
      <div className="absolute -top-24 left-[8%] h-[26rem] w-[26rem] rounded-full bg-zblue-400/40 blur-[110px] animate-blob1 mix-blend-multiply" />
      <div className="absolute top-[18%] right-[6%] h-[24rem] w-[24rem] rounded-full bg-zorange-400/40 blur-[110px] animate-blob2 mix-blend-multiply" />
      <div className="absolute bottom-[-6rem] left-[28%] h-[28rem] w-[28rem] rounded-full bg-znavy-400/30 blur-[120px] animate-blob3 mix-blend-multiply" />
      <div className="absolute bottom-[10%] right-[22%] h-[18rem] w-[18rem] rounded-full bg-zblue-300/30 blur-[100px] animate-blob2 mix-blend-multiply" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle, #10162b 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
    </div>
  )
}
