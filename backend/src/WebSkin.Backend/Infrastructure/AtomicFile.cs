using System.Text;

namespace WebSkin.Backend.Infrastructure;

public static class AtomicFile
{
    public static void WriteUtf8(string path, string content)
        => Write(path, stream =>
        {
            using var writer = new StreamWriter(stream, new UTF8Encoding(false), 1024, true);
            writer.Write(content);
            writer.Flush();
        });

    public static void WriteBytes(string path, byte[] content)
        => Write(path, stream => stream.Write(content, 0, content.Length));

    private static void Write(string path, Action<FileStream> write)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temporary = Path.Combine(Path.GetDirectoryName(path)!, $".{Path.GetFileName(path)}.{Guid.NewGuid():N}.tmp");
        try
        {
            using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            {
                write(stream);
                stream.Flush(true);
            }
            Replace(temporary, path);
        }
        finally
        {
            try { if (File.Exists(temporary)) File.Delete(temporary); } catch { }
        }
    }

    private static void Replace(string temporary, string target)
    {
        if (!File.Exists(target))
        {
            File.Move(temporary, target);
            return;
        }

        try { File.Replace(temporary, target, null, true); }
        catch (PlatformNotSupportedException) { File.Move(temporary, target, true); }
    }
}
