import FileBrowser from "../components/FileBrowser";

const Home = () => {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">Public Storage</h1>
        <p className="text-xl text-default-500 max-w-[700px]">
          Access and preview shared files instantly. Simple, fast, and private.
        </p>
      </header>
      <FileBrowser />
    </div>
  );
};

export default Home;
