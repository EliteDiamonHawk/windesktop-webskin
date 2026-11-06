using System.Text;

namespace WebSkin.Backend.Infrastructure;

public static class PathEncoding
{
    public static string PythonQuote(string value) => Encode(value, IsUnreserved);

    public static string EncodeURIComponent(string value) => Encode(value, character =>
        IsUnreserved(character)
        || character == (byte)'!'
        || character == 39
        || character == (byte)'('
        || character == (byte)')'
        || character == (byte)'*');

    private static string Encode(string value, Func<byte, bool> isSafe)
    {
        var bytes = Encoding.UTF8.GetBytes(value);
        var builder = new StringBuilder(bytes.Length);
        const string hex = "0123456789ABCDEF";
        foreach (var byteValue in bytes)
        {
            if (isSafe(byteValue)) builder.Append((char)byteValue);
            else builder.Append('%').Append(hex[byteValue >> 4]).Append(hex[byteValue & 15]);
        }
        return builder.ToString();
    }

    private static bool IsUnreserved(byte value) =>
        value >= (byte)'A' && value <= (byte)'Z'
        || value >= (byte)'a' && value <= (byte)'z'
        || value >= (byte)'0' && value <= (byte)'9'
        || value == (byte)'-' || value == (byte)'_' || value == (byte)'.' || value == (byte)'~';
}
