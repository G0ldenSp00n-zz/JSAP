importScripts('http://localhost:9000/dmp')

const dmp = new diff_match_patch();

self.addEventListener('fetch', function(event) {
    console.log(event.request.url, event.request.url.split('/fullFile/')[1]);

    event.respondWith(new Promise(function(resolve, reject){
        console.log("RUNNING")
        if(event.request.url.split('/fullFile/').length > 1){
            caches.open('currURIHash').then(function(hashCache){
                hashCache.match(event.request.url).then(function (response) {
                    console.log(response)
                    if(response){
                        console.log("MATCHED")
                        response.json().then(function (json) {
                            console.log("PARSED")
                            let hash = json.hash;
                            let body = json.file;
                            fetch('http://localhost:9000/pakPatch/' + hash + '/' + event.request.url.split('/fullFile/')[1]).then(function(patchResponse) {
                                patchResponse.json().then(function (jsonPatch) {
                                    // console.log(jsonPatch.patches)
                                    console.log("Patches", jsonPatch.patches);
                                    if(!jsonPatch.patches) {
                                        hashCache.put(event.request.url, new Response(new ReadableStream(jsonPatch)));
                                        return resolve(new Response(jsonPatch.file));
                                    } else {
                                        if(jsonPatch.patches.length === 0) {
                                            return resolve(new Response(body));
                                        } else {
                                            let updatedBody = dmp.patch_apply(jsonPatch.patches, body);
                                            hashCache.put(event.request.url, new Response(new ReadableStream({hash: jsonPatch.hash, file: updatedBody[0]})))
                                            return resolve(new Response(updatedBody[0]));
                                        }
                                    }
                                })
                            })
                        }).catch((err) => {
                            console.log("JSON Error -", err);
                        })
                    } else {
                        fetch('http://localhost:9000/pakGet/' + event.request.url.split('/fullFile/')[1]).then(function(data) {
                            if(data.status === 200) {
                                console.log(data);
                                hashCache.put(event.request.url, data.clone());
                                data.json().then(function (json) {
                                    // let stream = new ReadableStream({
                                    //     start(controller) {
                                    //         controller.enque({hash: json.hash, file: json.file});
                                    //         controller.close();
                                    //     }
                                    // })
                                    // hashCache.put(event.request.url, new Response(stream, {headers: {type : 'application/json'}}));
                                    return resolve(new Response(json.file));
                                });
                            }
                        })
                    }
                });
            })
            // console.log("CUSTOM FETCH")
            // let testFetch = fetch("http://localhost:9000/pakData/" + event.request.url.split('/fullFile/')[1]);
            // testFetch.then(function(res) {
            //     console.log(res.body);
            // });
            // event.respondWith(
            //     testFetch
            // );
        } else {
            resolve(fetch(event.request.url));
        }
    }));
})