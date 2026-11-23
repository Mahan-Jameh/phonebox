using System.Text.Json;
using Microsoft.AspNetCore.Http;
using PhoneBox.Agent;
using Xunit;

public sealed class TabShareTests
{
    private const string Image = "/9j/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

    private static JsonElement Payload(IResult result) =>
        JsonSerializer.SerializeToElement(Assert.IsAssignableFrom<IValueHttpResult>(result).Value,
            new JsonSerializerOptions(JsonSerializerDefaults.Web));

    private static int? Status(IResult result) => Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode;

    [Fact]
    public void InputIsDeliveredOnceToTheSelectedTabAndOnlyOneTabletCanClaim()
    {
        var share = new TabShare();
        var start = Payload(share.Desktop(new("start", null, 0, null)));
        var desktop = start.GetProperty("token").GetString();
        var code = start.GetProperty("code").GetString()!;
        var tablet = Payload(share.Claim("tablet", code)).GetProperty("token").GetString()!;
        Assert.Equal(404, Status(share.Claim("other", code)));
        Assert.Equal(404, Status(share.View("other", tablet, 0)));
        Assert.Equal(404, Status(share.View("tablet", desktop!, 0)));

        Assert.Equal(JsonValueKind.Null, Payload(share.Desktop(new("exchange", desktop, 1, Image))).GetProperty("input").ValueKind);
        Assert.Equal(1, Payload(share.View("tablet", tablet, 0)).GetProperty("sequence").GetInt32());
        Assert.Equal(400, Status(share.Send("tablet", tablet, new(1, "text", 0, 0, 0, "password"))));
        Assert.Equal(409, Status(share.Send("tablet", tablet, new(2, "tap", .5, .5, 0, null))));
        Assert.Equal(200, Status(share.Send("tablet", tablet, new(1, "tap", .5, .5, 0, null))));
        Assert.Equal(409, Status(share.Send("tablet", tablet, new(1, "tap", .5, .5, 0, null))));
        Assert.Equal("tap", Payload(share.Desktop(new("exchange", desktop, 2, Image))).GetProperty("input").GetProperty("kind").GetString());
        Assert.Equal(JsonValueKind.Null, Payload(share.Desktop(new("exchange", desktop, 3, Image))).GetProperty("input").ValueKind);
        Assert.Equal(200, Status(share.Leave("tablet", tablet)));
        Assert.Equal(404, Status(share.Desktop(new("exchange", desktop, 4, Image))));
    }

    [Fact]
    public void SixBadAttemptsInvalidateTheCodeAndDesktopBridgeIsNeverOnThePhonePort()
    {
        var share = new TabShare();
        var local = Payload(share.Desktop(new("start", null, 0, null)));
        var code = local.GetProperty("code").GetString()!;
        for (var i = 0; i < 6; i++) Assert.Equal(404, Status(share.Claim("tablet", "wrong")));
        Assert.Equal(404, Status(share.Claim("tablet", code)));
        Assert.False(Lan.AllowedOverLan(TabShare.BridgePath));
        Assert.False(Lan.IsWebhook(TabShare.ViewerPath + "/frame"));
        Assert.True(Lan.AllowedOverLan(TabShare.ViewerPath + "/frame"));
    }
}
