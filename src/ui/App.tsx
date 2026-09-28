import { useEffect, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { Spinner } from "@inkjs/ui";

import { rm } from "node:fs/promises";
import path from "node:path";

import { scanDirectory, MIN_SIZE } from "../index.js";

import type { ScanResultType } from "../types.js";

type AppProps = {
    rootPath: string;
};

function formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB", "TB"];

    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }

    return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function getDisplayPath(rootPath: string, targetPath: string): string {
    const relativePath = path.relative(rootPath, targetPath);

    if (!relativePath) {
        return ".";
    }

    return `.${path.sep}${relativePath}`;
}

export const App = ({ rootPath }: AppProps) => {
    const { exit } = useApp();

    const [isScanning, setIsScanning] = useState(true);
    const [results, setResults] = useState<ScanResultType[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const [cursor, setCursor] = useState(0);

    const [confirmDelete, setConfirmDelete] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    async function performScan() {
        try {
            setIsScanning(true);
            setError(null);
            setMessage(null);

            const directories = await scanDirectory(rootPath);

            setResults(directories);
            setSelected(new Set());
            setCursor(0);
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("Something went wrong while scanning.");
            }
        } finally {
            setIsScanning(false);
        }
    }

    useEffect(() => {
        void performScan();
    }, [rootPath]);

    useInput((input, key) => {
        if (isScanning || isDeleting) {
            return;
        }

        // Quit
        if (input === "q" || key.escape) {
            if (confirmDelete) {
                setConfirmDelete(false);
                return;
            }

            exit();
            return;
        }

        // Confirmation screen
        if (confirmDelete) {
            if (key.return) {
                void deleteSelected();
            }

            return;
        }

        if (results.length === 0) {
            return;
        }

        // we select the dir using the cursor state variable
        if (key.upArrow) {
            setCursor((current) => Math.max(0, current - 1));
        }

        if (key.downArrow) {
            setCursor((current) => Math.min(results.length - 1, current + 1));
        }

        // Select / deselect
        if (input === " ") {
            const currentDirectory = results[cursor];
            setSelected((previous) => {
                if (!currentDirectory) {
                    return previous;
                }
                // here we are storing unique selected file paths
                const next = new Set(previous);

                if (next.has(currentDirectory.path)) {
                    next.delete(currentDirectory.path);
                } else {
                    next.add(currentDirectory.path);
                }

                return next;
            });
        }

        // Start delete confirmation
        if (input === "d" && selected.size > 0) {
            setConfirmDelete(true);
        }
    });

    async function deleteSelected() {
        if (selected.size === 0) {
            return;
        }

        setConfirmDelete(false);
        setIsDeleting(true);
        setError(null);
        setMessage(null);

        try {
            for (const directoryPath of selected) {
                await rm(directoryPath, {
                    recursive: true,
                    force: true,
                });
            }

            setMessage(
                `Deleted ${selected.size} director${selected.size === 1 ? "y" : "ies"}.`,
            );

            await performScan();
        } catch (err) {
            if (err instanceof Error) {
                setError(`Delete failed: ${err.message}`);
            } else {
                setError("Delete failed.");
            }
        } finally {
            setIsDeleting(false);
        }
    }

    const selectedSize = results
        .filter((directory) => selected.has(directory.path))
        .reduce((total, directory) => total + directory.size, 0);

    if (isScanning) {
        return (
            <Box flexDirection="column" padding={1}>
                <Text bold color="cyan">
                    cleanX
                </Text>

                <Box marginTop={1} gap={1}>
                    <Spinner />
                    <Text>Scanning:</Text>

                    <Text dimColor> {rootPath}</Text>
                </Box>

                <Box marginTop={1}>
                    <Text dimColor>Calculating directory sizes...</Text>
                </Box>
            </Box>
        );
    }

    if (isDeleting) {
        return (
            <Box flexDirection="column" padding={1}>
                <Text bold color="cyan">
                    cleanX
                </Text>

                <Box marginTop={1}>
                    <Spinner />
                    <Text>Deleting selected directories...</Text>
                </Box>
            </Box>
        );
    }

    if (error) {
        return (
            <Box flexDirection="column" padding={1}>
                <Text bold color="red">
                    Error
                </Text>

                <Box marginTop={1}>
                    <Text color="red">{error}</Text>
                </Box>

                <Box marginTop={1}>
                    <Text dimColor>Press Q to exit.</Text>
                </Box>
            </Box>
        );
    }

    if (confirmDelete) {
        return (
            <Box flexDirection="column" padding={1}>
                <Text bold color="red">
                    Delete selected directories?
                </Text>

                <Box flexDirection="column" marginTop={1}>
                    {results
                        .filter((directory) => selected.has(directory.path))
                        .map((directory) => (
                            <Text key={directory.path}>
                                • {getDisplayPath(rootPath, directory.path)}
                            </Text>
                        ))}
                </Box>

                <Box marginTop={1}>
                    <Text>
                        Reclaim:{" "}
                        <Text bold color="yellow">
                            {formatBytes(selectedSize)}
                        </Text>
                    </Text>
                </Box>

                <Box marginTop={1}>
                    <Text color="red">Press Enter to delete</Text>

                    <Text dimColor>{"  "}Esc to cancel</Text>
                </Box>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold color="cyan">
                cleanX
            </Text>

            <Text dimColor>{rootPath}</Text>

            <Box marginTop={1}>
                <Text>
                    Directories larger than{" "}
                    <Text bold color="yellow">
                        {formatBytes(MIN_SIZE)}
                    </Text>
                </Text>
            </Box>

            {message && (
                <Box marginTop={1}>
                    <Text color="green">✓ {message}</Text>
                </Box>
            )}

            <Box marginTop={1} flexDirection="column">
                {results.length === 0 ? (
                    <Text color="green">
                        No directories larger than 200 MB found.
                    </Text>
                ) : (
                    results.map((directory, index) => {
                        const isCurrent = index === cursor;
                        const isSelected = selected.has(directory.path);

                        return (
                            <Box key={directory.path}>
                                <Text
                                    color={isCurrent ? "cyan" : ""}
                                    bold={isCurrent}
                                >
                                    {isCurrent ? ">" : " "} [
                                    {isSelected ? "x" : " "}]{" "}
                                    {formatBytes(directory.size)}{" "}
                                    {getDisplayPath(rootPath, directory.path)}
                                </Text>
                            </Box>
                        );
                    })
                )}
            </Box>

            {selected.size > 0 && (
                <Box marginTop={1}>
                    <Text>
                        Selected:{" "}
                        <Text bold color="yellow">
                            {selected.size}
                        </Text>{" "}
                        ({formatBytes(selectedSize)})
                    </Text>
                </Box>
            )}

            <Box marginTop={1}>
                <Text dimColor>
                    ↑↓ Navigate {"  "}
                    Space Select {"  "}D Delete {"  "}Q Quit
                </Text>
            </Box>
        </Box>
    );
};
