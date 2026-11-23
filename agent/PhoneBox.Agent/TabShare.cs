using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace PhoneBox.Agent;

// One desktop-selected tab and one paired viewer. All credentials, frames and input live in memory.
internal sealed class TabShare
{
    internal const string ExtensionOrigin = "chrome-extension://gkaegedgekbocjofbgmhgdlahdopjcmo";
    internal const string BridgePath = "/api/tab-share/bridge";
    internal const string ViewerPath = "/api/tab-share/viewer";
    private readonly Lock _gate = new();
    private string? _desktop, _code, _device, _viewer;
    private int _tries;
    private long _started, _heartbeat;
    private Frame? _frame;
    private Input? _input;

    internal sealed record Frame(long Sequence, string Image, long At);
    internal sealed record DesktopRequest(string Action, string? Token, long Sequence, string? Image);
    internal sealed record Input(long Sequence, string Kind, double X, double Y, double Delta, string? Text);
    private static long Now => Environment.TickCount64;
    private static string Secret() => Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
    private static bool Equal(string? a, string? b) => a is not null && b is not null && a.Length == b.Length &&
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));
    private bool Active => _desktop is not null && Now - _heartbeat < 10_000 && Now - _started < 30 * 60_000;

    private void Clear()
    {
        _desktop = _code = _device = _viewer = null;
        _frame = null;
        _input = null;
        _tries = 0;
    }

    internal IResult Desktop(DesktopRequest request)
    {
        lock (_gate)
        {
            if (!Active) Clear();
            if (request.Action == "start")
            {
                Clear();
                _desktop = Secret();
                _code = RandomNumberGenerator.GetInt32(100_000_000).ToString("D8", CultureInfo.InvariantCulture);
                _started = _heartbeat = Now;
                return Results.Json(new { token = _desktop, code = _code });
            }
            if (!Equal(_desktop, request.Token)) return Results.NotFound();
            if (request.Action == "stop")
            {
                Clear();
                return Results.Ok();
            }
            if (request.Action != "exchange" || request.Sequence <= (_frame?.Sequence ?? 0) ||
                request.Image is not { Length: > 32 and < 800_000 } image ||
                !image.StartsWith("/9j/", StringComparison.Ordinal)) return Results.BadRequest();
            _heartbeat = Now;
            _frame = new(request.Sequence, image, Now);
            var input = _input;
            _input = null; // never retry any click after an ambiguous network or browser outcome
            return Results.Json(new { input });
        }
    }

    internal IResult Claim(string device, string code)
    {
        lock (_gate)
        {
            if (!Active || Now - _started > 120_000 || _code is null || device.Length is 0 or > 128)
                return Results.NotFound();
            if (!Equal(_code, code))
            {
                if (++_tries >= 6) _code = null;
                return Results.NotFound();
            }
            _code = null;
            _device = device;
            _viewer = Secret();
            return Results.Json(new { token = _viewer });
        }
    }

    private bool Authorized(string device, string token) =>
        Active && Equal(_viewer, token) && string.Equals(_device, device, StringComparison.Ordinal);

    internal IResult View(string device, string token, long after)
    {
        lock (_gate)
        {
            if (!Authorized(device, token)) return Results.NotFound();
            if (_frame is not { } f || f.Sequence <= after || Now - f.At > 2_000)
                return Results.Json(new { waiting = true });
            return Results.Json(new { sequence = f.Sequence, image = f.Image });
        }
    }

    internal IResult Leave(string device, string token)
    {
        lock (_gate)
        {
            if (!Authorized(device, token)) return Results.NotFound();
            Clear();
            return Results.Ok();
        }
    }

    internal IResult Send(string device, string token, Input input)
    {
        lock (_gate)
        {
            if (!Authorized(device, token)) return Results.NotFound();
            if (_input is not null || _frame is not { } f || Now - f.At > 1_500 ||
                input.Sequence <= 0 || input.Sequence > f.Sequence || f.Sequence - input.Sequence > 2)
                return Results.Conflict();
            if (!(input.X is >= 0 and <= 1 && input.Y is >= 0 and <= 1)) return Results.BadRequest();
            if (input.Kind switch
            {
                "tap" => input.Text is not null,
                "scroll" => input.Delta is < -900 or > 900 || !double.IsFinite(input.Delta),
                "text" => input.Text is not { Length: > 0 and <= 32 } ||
                    input.Text.Any(c => !char.IsAsciiDigit(c) && c is not ('.' or ',' or '-')),
                "key" => input.Text is not ("Backspace" or "Tab" or "Escape"),
                _ => true,
            }) return Results.BadRequest();
            _input = input;
            return Results.Ok();
        }
    }
}
