using System.Runtime.InteropServices;
using System.Text.RegularExpressions;

internal sealed class Hardware
{
    [StructLayout(LayoutKind.Sequential)] private struct FileTime { public uint Low, High; public readonly ulong Ticks => ((ulong)High << 32) | Low; }
    [StructLayout(LayoutKind.Sequential)] private struct MemoryStatus
    {
        public uint Length, Load;
        public ulong TotalPhys, AvailPhys, TotalPage, AvailPage, TotalVirtual, AvailVirtual, Extended;
    }
    [StructLayout(LayoutKind.Sequential)] private struct FormatValue { public uint Status; public double Value; }
    [StructLayout(LayoutKind.Sequential)] private struct FormatItem { public IntPtr Name; public FormatValue Value; }
    [DllImport("kernel32.dll")] private static extern bool GetSystemTimes(out FileTime idle, out FileTime kernel, out FileTime user);
    [DllImport("kernel32.dll")] private static extern bool GlobalMemoryStatusEx(ref MemoryStatus status);
    [DllImport("pdh.dll", CharSet = CharSet.Unicode)] private static extern uint PdhOpenQueryW(string? source, IntPtr data, out IntPtr query);
    [DllImport("pdh.dll", CharSet = CharSet.Unicode)] private static extern uint PdhAddEnglishCounterW(IntPtr query, string counter, IntPtr data, out IntPtr handle);
    [DllImport("pdh.dll")] private static extern uint PdhCollectQueryData(IntPtr query);
    [DllImport("pdh.dll")] private static extern uint PdhGetFormattedCounterArrayW(IntPtr counter, uint format, ref uint bytes, out uint count, IntPtr buffer);
    private ulong previousIdle, previousTotal;
    private bool sampled;
    private readonly IntPtr query, gpuCounter, vramCounter;
    internal Hardware()
    {
        if (PdhOpenQueryW(null, IntPtr.Zero, out query) == 0)
        {
            PdhAddEnglishCounterW(query, @"\GPU Engine(*)\Utilization Percentage", IntPtr.Zero, out gpuCounter);
            PdhAddEnglishCounterW(query, @"\GPU Adapter Memory(*)\Dedicated Usage", IntPtr.Zero, out vramCounter);
            PdhCollectQueryData(query);
        }
    }
    private static Dictionary<string, double>? Read(IntPtr handle)
    {
        if (handle == IntPtr.Zero) return null;
        uint size = 0;
        uint result = PdhGetFormattedCounterArrayW(handle, 0x200, ref size, out _, IntPtr.Zero);
        if (result != 0x800007D2 || size == 0 || size > 16 * 1024 * 1024) return null;
        var memory = Marshal.AllocHGlobal((int)size);
        try
        {
            if (PdhGetFormattedCounterArrayW(handle, 0x200, ref size, out uint count, memory) != 0) return null;
            var values = new Dictionary<string, double>();
            int stride = Marshal.SizeOf<FormatItem>();
            for (int i = 0; i < count; i++)
            {
                var item = Marshal.PtrToStructure<FormatItem>(IntPtr.Add(memory, i * stride));
                if (item.Value.Status <= 1 && double.IsFinite(item.Value.Value)) values[Marshal.PtrToStringUni(item.Name) ?? ""] = item.Value.Value;
            }
            return values;
        }
        finally { Marshal.FreeHGlobal(memory); }
    }
    internal object Sample()
    {
        double? cpu = null;
        if (GetSystemTimes(out var idle, out var kernel, out var user))
        {
            ulong total = kernel.Ticks + user.Ticks;
            if (sampled && total > previousTotal && idle.Ticks >= previousIdle)
                cpu = Math.Clamp(100.0 * (1.0 - (double)(idle.Ticks - previousIdle) / (total - previousTotal)), 0, 100);
            previousIdle = idle.Ticks; previousTotal = total; sampled = true;
        }
        var memory = new MemoryStatus { Length = (uint)Marshal.SizeOf<MemoryStatus>() };
        bool hasMemory = GlobalMemoryStatusEx(ref memory);
        double? gpu = null, dedicated = null;
        if (query != IntPtr.Zero && PdhCollectQueryData(query) == 0)
        {
            var engines = Read(gpuCounter);
            if (engines is not null && engines.Count > 0)
            {
                var grouped = engines.GroupBy(e => Regex.Match(e.Key, @"luid_.+?_phys_\d+_eng_\d+").Value)
                    .Where(g => g.Key.Length > 0).Select(g => g.Sum(e => Math.Max(0, e.Value))).ToArray();
                if (grouped.Length > 0) gpu = Math.Clamp(grouped.Max(), 0, 100);
            }
            var vram = Read(vramCounter);
            if (vram is not null && vram.Count > 0) dedicated = vram.Values.Sum();
        }
        return new { cpu, memory = hasMemory ? (double?)memory.Load : null,
            memoryUsedBytes = hasMemory ? (ulong?)(memory.TotalPhys - memory.AvailPhys) : null,
            memoryTotalBytes = hasMemory ? (ulong?)memory.TotalPhys : null, gpu, gpuDedicatedBytes = dedicated };
    }
}
