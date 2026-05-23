export default function LoadingSpinner({ message = 'Loading servers…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-10 h-10 border-2 border-dark-500 border-t-rust-500 rounded-full animate-spin" />
      <p className="text-dark-300 text-sm">{message}</p>
    </div>
  );
}
