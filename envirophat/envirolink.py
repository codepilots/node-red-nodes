#!/usr/bin/env python

# Modified from the Explorer Hat source by Chris Thomson
# 27/4/17 - Added handlers for temperature

import time
import sys
from threading import Thread, Event
from Queue import Queue, Empty

class NonBlockingStreamReader:

    def __init__(self, stream):
        '''
        stream: the stream to read from.
                Usually a process' stdout or stderr.
        '''

        self._s = stream
        self._q = Queue()
        self._stop_event = Event()

        def _populateQueue(stream, queue, stop_event):
            '''
            Collect lines from 'stream' and put them in 'queue'.
            '''
            while not stop_event.is_set():
                line = stream.readline()
                if line:
                    queue.put(line)

        self._t = Thread(target = _populateQueue,
                args = (self._s, self._q, self._stop_event))
        self._t.daemon = True
        self._t.start() #start collecting lines from the stream

    def readline(self, timeout = None):
        try:
            return self._q.get(block = timeout is not None, timeout = timeout)
        except Empty:
            return None

    def stop(self):
        self._stop_event.set()


def millis():
    return int(round(time.time() * 1000))

# Write value to stdout, that will be picked up by nodeRED
def emit(message):
    sys.stdout.write(message + "\n")
    sys.stdout.flush()

def error(message):
    emit("ERROR: " + message)

def fatal(message):
    emit("FATAL: " + message)
    sys.exit(1)


try:
    from envirophat import light, weather, motion, analog
except ImportError:
    fatal("Unable to import envirophat python library")

running = True

stdin = NonBlockingStreamReader(sys.stdin)

def handle_command(cmd):
    if cmd is not None:
        cmd = cmd.strip()

		#Code to do with handling outputs / requests goes here 
		
		# Read the temperature sensor from the Enviro pHAT
        if cmd.startswith("temp"):
            temp = round(weather.temperature(),2)
            emit("temp:{}".format(temp))
            return

        if cmd.startswith("stop"):
            stdin.stop()
            running = False


while running:
    cmd = stdin.readline(0.1)
    handle_command(cmd)
    time.sleep(0.001)

