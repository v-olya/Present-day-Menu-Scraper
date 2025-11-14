type ErrorMessageProps = {
  message: string;
  className?: string;
};

export default function ErrorMessage({
  message,
  className = "",
}: ErrorMessageProps) {
  return (
    <div
      className={
        "bg-red-50 border border-red-200 text-red-800 p-4 rounded text-center " +
        className
      }
      role="alert"
    >
      {message}
    </div>
  );
}
